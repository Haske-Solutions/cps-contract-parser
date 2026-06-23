import archiver, { type Archiver } from 'archiver'
import { PassThrough } from 'stream'
import type { BatchExportSummary, BatchSessionContext } from '../../shared/types'
import { batchMismatchFlags } from '../../shared/sessionBuilder'
import { validationFlagsToNotes } from '../../shared/validationNotes'
import { buildRows, buildWorkbookBuffer } from './exportService'
import { buildBatchExportSession } from './batchSessionBuilder'
import { saveSession } from './historyService'

function createZipArchive(options?: archiver.ArchiverOptions): Archiver {
  return archiver('zip', options)
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

  const exportPeIds = context.reviewedPeIds?.length
    ? context.batchPeIds.filter((id) => context.reviewedPeIds!.includes(id))
    : context.batchPeIds

  for (const peId of exportPeIds) {
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
      const session = await buildBatchExportSession(supplier, extraction, parentSessionId)
      const { rateRows, extrasRows, flags, validationNotes } = buildRows(session)
      const allFlags = [...flags, ...batchMismatchFlags(extraction)]
      const allNotes = [...validationNotes, ...validationFlagsToNotes(batchMismatchFlags(extraction))]
      const buffer = await buildWorkbookBuffer(rateRows, extrasRows, allFlags, allNotes)
      const filename = `CPS_${sanitizeFilename(supplier.code)}_rates.xlsx`

      archive.append(Buffer.from(buffer), { name: filename })

      await saveSession({
        ...session,
        outputRows: rateRows,
        extrasRows,
        validationFlags: allFlags,
      })

      summaries.push({
        supplierId: peId,
        supplierName: supplier.name,
        supplierCode: supplier.code,
        success: true,
        rateRowCount: rateRows.length,
        validationFlagCount: allFlags.length,
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
