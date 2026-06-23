import { supplierSearchTermsFromFilenames } from '../../shared/supplierSearch'
import type {
  Supplier,
  ServiceMatch,
  PEService,
  PriorRate,
  ServiceInventoryCounts,
} from '../../shared/types'
import { runQuery, runQueryBound, testMotherduckConnection } from './motherduckClient'

const ACCOMMODATION_TYPE_NAMES = [
  'Double',
  'Twin',
  'Single',
  'Triple',
  'Quadruple',
  'House',
] as const

const NON_ACCOMMODATION_TYPE_NAMES = [
  'Transfer',
  'Activity',
  'Vehicle Use',
  'Driver Accommodation',
  'Guide Accommodation',
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
    head_office_name:
      row.head_office_name == null ? undefined : String(row.head_office_name),
  }
}

function mapSupplierRows(rows: Record<string, unknown>[]): Supplier[] {
  return rows.map(mapSupplierRow)
}

async function backfillFromFactServices(supplier: Supplier): Promise<Supplier> {
  const needsBackfill =
    !supplier.supplier_id || !supplier.name || !supplier.code
  if (!needsBackfill) return supplier

  const rows = await runQueryBound<Record<string, unknown>>(
    `SELECT DISTINCT supplier_id, supplier_name AS name, supplier_code AS code
     FROM fact_services
     WHERE supplier_id = $1 OR supplier_name ILIKE $2
     LIMIT 1`,
    [String(supplier.supplier_id || 0), `%${supplier.name}%`],
  )
  if (rows.length === 0) return supplier
  const row = rows[0]
  return {
    ...supplier,
    supplier_id: Number(row.supplier_id) || supplier.supplier_id,
    name: String(row.name ?? supplier.name),
    code: String(row.code ?? supplier.code),
  }
}

export async function resolveSupplier(supplier: Supplier): Promise<Supplier> {
  if (supplier.supplier_id && supplier.name && supplier.code) return supplier
  return backfillFromFactServices(supplier)
}

async function queryPeServices(supplierId: number, whereClause: string): Promise<PEService[]> {
  const id = Math.trunc(supplierId)
  const sql = `SELECT id, name, code FROM supplier_services WHERE supplier_id = ${id} AND not_in_use = false AND (${whereClause}) ORDER BY name LIMIT 200`
  return runQuery<PEService>(sql)
}

async function countServices(supplierId: number, whereClause: string): Promise<number> {
  const id = Math.trunc(supplierId)
  const rows = await runQuery<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM supplier_services WHERE supplier_id = ${id} AND not_in_use = false AND (${whereClause})`,
  )
  return Number(rows[0]?.cnt ?? 0)
}

export async function supplierLookup(name: string): Promise<Supplier[]> {
  const term = name.trim()
  if (!term) return []
  let rows = await runQueryBound<Record<string, unknown>>(
    'SELECT supplier_id, name, code, destination_country, head_office_name FROM dim_suppliers WHERE name ILIKE $1 ORDER BY name LIMIT 20',
    [`%${term}%`],
  )
  if (rows.length === 0) {
    rows = await runQueryBound<Record<string, unknown>>(
      `SELECT DISTINCT supplier_id, supplier_name AS name, supplier_code AS code, '' AS destination_country, '' AS head_office_name
       FROM fact_services WHERE supplier_name ILIKE $1 LIMIT 20`,
      [`%${term}%`],
    )
  }
  const suppliers = mapSupplierRows(rows)
  return Promise.all(suppliers.map(resolveSupplier))
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

export async function accommodationSupplierCatalog(anchorTerm: string): Promise<Supplier[]> {
  const term = anchorTerm.trim()
  if (!term) return []
  const rows = await runQueryBound<Record<string, unknown>>(
    `SELECT DISTINCT s.supplier_id, s.name, s.code, s.destination_country, s.head_office_name
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

export async function fetchAccommodationServices(supplierId: number): Promise<PEService[]> {
  return queryPeServices(
    supplierId,
    `type_name IN (${sqlInList(ACCOMMODATION_TYPE_NAMES)})`,
  )
}

export async function fetchNonAccommodationServices(supplierId: number): Promise<PEService[]> {
  return queryPeServices(
    supplierId,
    `type_name IN (${sqlInList(NON_ACCOMMODATION_TYPE_NAMES)}) OR type_name NOT IN (${sqlInList([...ACCOMMODATION_TYPE_NAMES, ...EXTRAS_TYPE_NAMES])})`,
  )
}

export async function fetchExtrasServices(supplierId: number): Promise<PEService[]> {
  return queryPeServices(supplierId, `type_name IN (${sqlInList(EXTRAS_TYPE_NAMES)})`)
}

export async function inventoryCounts(supplierId: number): Promise<ServiceInventoryCounts> {
  const id = Math.trunc(supplierId)
  const [accommodation, nonAccommodation, extras] = await Promise.all([
    countServices(id, `type_name IN (${sqlInList(ACCOMMODATION_TYPE_NAMES)})`),
    countServices(id, `type_name IN (${sqlInList(NON_ACCOMMODATION_TYPE_NAMES)})`),
    countServices(id, `type_name IN (${sqlInList(EXTRAS_TYPE_NAMES)})`),
  ])
  return { accommodation, nonAccommodation, extras }
}

/** Returns raw PE inventory for token matching (not pre-marked as matched). */
export async function serviceMatch(supplierId: number): Promise<ServiceMatch[]> {
  const services = await fetchAccommodationServices(supplierId)
  return services.map((row) => ({
    extractedName: row.name,
    peServiceId: row.id,
    peServiceName: row.name,
    peServiceCode: row.code,
    status: 'matched' as const,
    candidates: [row],
    bucket: 'accommodation' as const,
  }))
}

export async function extrasMatch(supplierId: number): Promise<ServiceMatch[]> {
  const services = await fetchExtrasServices(supplierId)
  return services.map((row) => ({
    extractedName: row.name,
    peServiceId: row.id,
    peServiceName: row.name,
    peServiceCode: row.code,
    status: 'matched' as const,
    candidates: [row],
    bucket: 'extras' as const,
  }))
}

export async function policyServiceMatch(supplierId: number): Promise<ServiceMatch[]> {
  const services = await queryPeServices(
    supplierId,
    `type_name = 'Single' OR name ILIKE '%CIOR%' OR name ILIKE '%child%' OR name ILIKE '%tier%'`,
  )
  return services.map((row) => ({
    extractedName: row.name,
    peServiceId: row.id,
    peServiceName: row.name,
    peServiceCode: row.code,
    status: 'matched' as const,
    candidates: [row],
    bucket: 'accommodation' as const,
  }))
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
