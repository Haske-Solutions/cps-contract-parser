import { supplierSearchTermsFromFilenames } from '../../shared/supplierSearch'
import type { Supplier, ServiceMatch, PEService, PriorRate } from '../../shared/types'
import { runQuery, runQueryBound, testMotherduckConnection } from './motherduckClient'

const ACCOMMODATION_TYPE_NAMES = [
  'Double',
  'Twin',
  'Single',
  'Triple',
  'Quadruple',
  'House',
] as const

const EXTRAS_TYPE_NAMES = [
  'Activity',
  'Conservancy Fees',
  'Park Fees',
  'Meals',
  'Miscellaneous',
  'Net Services',
  'Rack Services',
  'Transfer',
  'Transport',
] as const

function escapeSql(value: string): string {
  return value.replace(/'/g, "''")
}

function sqlInList(values: readonly string[]): string {
  return values.map((v) => `'${escapeSql(v)}'`).join(', ')
}

function mapSupplierRow(row: Record<string, unknown>): Supplier {
  return {
    supplier_id: Number(row.supplier_id),
    name: String(row.name ?? ''),
    code: row.code == null ? '' : String(row.code),
    destination_country: row.destination_country == null ? '' : String(row.destination_country),
  }
}

function mapSupplierRows(rows: Record<string, unknown>[]): Supplier[] {
  return rows.map(mapSupplierRow)
}

function mapServiceRows(rows: PEService[]): ServiceMatch[] {
  return rows.map((row) => ({
    extractedName: row.name,
    peServiceId: row.id,
    peServiceName: row.name,
    peServiceCode: row.code,
    status: 'matched' as const,
    candidates: [row],
  }))
}

async function querySupplierServices(
  supplierId: number,
  whereClause: string,
): Promise<ServiceMatch[]> {
  const id = Math.trunc(supplierId)
  const sql = `SELECT id, name, code FROM supplier_services WHERE supplier_id = ${id} AND not_in_use = false AND (${whereClause}) ORDER BY name LIMIT 200`
  const rows = await runQuery<PEService>(sql)
  return mapServiceRows(rows)
}

export async function supplierLookup(name: string): Promise<Supplier[]> {
  const term = name.trim()
  if (!term) return []
  const rows = await runQueryBound<Record<string, unknown>>(
    'SELECT supplier_id, name, code, destination_country FROM dim_suppliers WHERE name ILIKE $1 ORDER BY name LIMIT 20',
    [`%${term}%`],
  )
  return mapSupplierRows(rows)
}

export async function supplierLookupFromFilenames(
  contractFormFilename: string,
  rateSheetFilename: string,
): Promise<Supplier[]> {
  const terms = supplierSearchTermsFromFilenames(contractFormFilename, rateSheetFilename)

  const seen = new Set<number>()
  const results: Supplier[] = []

  for (const term of terms) {
    const rows = await supplierLookup(term)
    for (const row of rows) {
      if (!seen.has(row.supplier_id)) {
        seen.add(row.supplier_id)
        results.push(row)
      }
    }
  }

  return results
}

/** Accommodation suppliers in PE matching an anchor term (brand/group from filenames). */
export async function accommodationSupplierCatalog(anchorTerm: string): Promise<Supplier[]> {
  const term = anchorTerm.trim()
  if (!term) return []
  const rows = await runQueryBound<Record<string, unknown>>(
    `SELECT DISTINCT s.supplier_id, s.name, s.code, s.destination_country
     FROM dim_suppliers s
     INNER JOIN supplier_services ss ON ss.supplier_id = s.supplier_id
     WHERE ss.not_in_use = false
       AND ss.type_name IN (${sqlInList(ACCOMMODATION_TYPE_NAMES)})
       AND (s.name ILIKE $1 OR s.code ILIKE $1)
     ORDER BY s.name
     LIMIT 200`,
    [`%${term}%`],
  )
  return mapSupplierRows(rows)
}

/** Union accommodation catalog results across multiple anchor terms (deduped by supplier_id). */
export async function accommodationSupplierCatalogForTerms(
  anchorTerms: string[],
): Promise<Supplier[]> {
  const seen = new Set<number>()
  const results: Supplier[] = []

  const terms = [...new Set(anchorTerms.map((t) => t.trim()).filter(Boolean))].sort(
    (a, b) => a.length - b.length || a.localeCompare(b),
  )

  for (const term of terms) {
    const rows = await accommodationSupplierCatalog(term)
    for (const row of rows) {
      if (!seen.has(row.supplier_id)) {
        seen.add(row.supplier_id)
        results.push(row)
      }
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

export async function serviceMatch(supplierId: number): Promise<ServiceMatch[]> {
  return querySupplierServices(
    supplierId,
    `type_name IN (${sqlInList(ACCOMMODATION_TYPE_NAMES)})`,
  )
}

export async function extrasMatch(supplierId: number): Promise<ServiceMatch[]> {
  return querySupplierServices(supplierId, `type_name IN (${sqlInList(EXTRAS_TYPE_NAMES)})`)
}

export async function policyServiceMatch(supplierId: number): Promise<ServiceMatch[]> {
  return querySupplierServices(
    supplierId,
    `type_name = 'Single' OR name ILIKE '%CIOR%' OR name ILIKE '%child%' OR name ILIKE '%tier%'`,
  )
}

export async function priorRates(
  supplierId: number,
  servicePattern: string,
): Promise<PriorRate[]> {
  const id = Math.trunc(supplierId)
  const pat = servicePattern.trim()
  const base = `SELECT service_name AS "serviceName", adult_cost AS "adultCost", child_cost AS "childCost", rate_type AS "rateType", currency_cost AS currency, log_timestamp AS "logTimestamp" FROM fact_pricing_history WHERE supplier_id = ${id}`
  const rows = pat
    ? await runQueryBound<Omit<PriorRate, 'percentChange'>>(
        `${base} AND service_name ILIKE $1 ORDER BY log_timestamp DESC LIMIT 50`,
        [`%${pat}%`],
      )
    : await runQuery<Omit<PriorRate, 'percentChange'>>(
        `${base} ORDER BY log_timestamp DESC LIMIT 50`,
      )
  return rows.map((row) => ({ ...row, percentChange: null }))
}

export { testMotherduckConnection as testConnection }
