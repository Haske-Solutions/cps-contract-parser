import archiver, { type Archiver } from 'archiver'
import { PassThrough } from 'stream'
import type {
  BatchExportSummary,
  BatchSessionContext,
  ConfirmedPolicy,
  ParseSession,
  Supplier,
} from '../../shared/types'
import { buildRows, generateExcel } from './exportService'
import {
  serviceMatch,
  extrasMatch,
  policyServiceMatch,
  priorRates,
} from './warehouseService'
import { saveSession } from './historyService'

function createZipArchive(options?: archiver.ArchiverOptions): Archiver {
  return archiver('zip', options)
}

function autoConfirmedPolicies(
  extraction: ParseSession['extraction'],
): ConfirmedPolicy[] {
  if (!extraction) return []
  return extraction.policies.map((p) => ({ type: p.type, confirmed: true }))
}

async function buildBatchSession(
  supplier: Supplier,
  extraction: NonNullable<ParseSession['extraction']>,
  sessionId: string,
): Promise<ParseSession> {
  const [accommodationMatches, extrasMatches, policyMatches, prior] = await Promise.all([
    serviceMatch(supplier.supplier_id),
    extrasMatch(supplier.supplier_id),
    policyServiceMatch(supplier.supplier_id),
    priorRates(supplier.supplier_id, ''),
  ])

  return {
    id: `${sessionId}-batch-${supplier.supplier_id}`,
    createdAt: new Date().toISOString(),
    supplier,
    ratePDF: null,
    contractForm: null,
    extraction,
    confirmedPolicies: autoConfirmedPolicies(extraction),
    serviceMatches: accommodationMatches,
    policyMatches,
    extrasMatches,
    priorRates: prior,
    mismatches: [],
    mismatchResolutions: [],
    outputRows: [],
    extrasRows: [],
    validationFlags: [],
    step: 6,
    status: 'complete',
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_')
}

async function streamToBuffer(stream: PassThrough): Promise<Buffer> {
  const chunks: Buffer[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

export async function generateBatchZip(
  context: BatchSessionContext,
  parentSessionId: string,
): Promise<{ zipBuffer: Uint8Array; summaries: BatchExportSummary[] }> {
  const stream = new PassThrough()
  const archive = createZipArchive({ zlib: { level: 9 } })
  archive.pipe(stream)

  const bufferPromise = streamToBuffer(stream)
  const summaries: BatchExportSummary[] = []

  for (const peId of context.batchPeIds) {
    const mapping = context.mappings.find(
      (m) => m.peSupplier?.supplier_id === peId && m.included,
    )
    const supplier = mapping?.peSupplier
    const extraction = context.extractionsByPeId[peId]

    if (!supplier || !extraction) {
      summaries.push({
        supplierId: peId,
        supplierName: supplier?.name ?? `PE ${peId}`,
        supplierCode: supplier?.code ?? '',
        success: false,
        rateRowCount: 0,
        validationFlagCount: 0,
        error: 'Missing supplier or extraction data',
      })
      continue
    }

    try {
      const session = await buildBatchSession(supplier, extraction, parentSessionId)
      const { rateRows, extrasRows, flags } = buildRows(session)
      const workbook = generateExcel(session)
      const filename = `CPS_${sanitizeFilename(supplier.code)}_rates.xlsx`

      archive.append(Buffer.from(workbook), { name: filename })

      await saveSession({
        ...session,
        outputRows: rateRows,
        extrasRows,
        validationFlags: flags,
      })

      summaries.push({
        supplierId: peId,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        success: true,
        rateRowCount: rateRows.length,
        validationFlagCount: flags.length,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      summaries.push({
        supplierId: peId,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        success: false,
        rateRowCount: 0,
        validationFlagCount: 0,
        error: msg,
      })
    }
  }

  await archive.finalize()
  const zipBuffer = await bufferPromise

  return { zipBuffer: new Uint8Array(zipBuffer), summaries }
}

export async function zipBufferEntries(
  entries: Array<{ filename: string; buffer: Uint8Array }>,
): Promise<Uint8Array> {
  const stream = new PassThrough()
  const archive = createZipArchive({ zlib: { level: 9 } })
  archive.pipe(stream)

  const bufferPromise = streamToBuffer(stream)

  for (const entry of entries) {
    archive.append(Buffer.from(entry.buffer), { name: entry.filename })
  }

  await archive.finalize()
  const zipBuffer = await bufferPromise
  return new Uint8Array(zipBuffer)
}
