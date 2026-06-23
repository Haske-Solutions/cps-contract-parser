import type {
  ExtractionBatchResult,
  ExtractionPropertyComplete,
  ExtractionResult,
  Supplier,
  SupplierDiscoveryResult,
  ExtractionProgress,
} from '../../shared/types'
import { MAX_CONCURRENT_EXTRACTIONS, MAX_CONCURRENT_PROXY_EXTRACTIONS, MAX_PROPERTIES_PER_RUN } from '../../shared/constants'
import {
  buildDiscoveryUserText,
  buildExtractionUserText,
  filterPeCatalogForExtraction,
  type ExtractRatesOptions,
} from '../../shared/parserInvoke'
import { SYSTEM_PROMPT } from '../prompts/systemPrompt'
import { DISCOVERY_PROMPT } from '../prompts/discoveryPrompt'
import { normalizeExtractionBatch } from './extractionValidation'
import { normalizeDiscoveryResult } from './discoveryValidation'
import { invokeClaude } from './bedrockClient'
import {
  discoverViaProxy,
  extractViaProxy,
  resolveParserProxyConfig,
} from './parserProxyClient'
import {
  getCachedExtraction,
  hashPdfPair,
  setCachedExtraction,
} from './extractionCacheService'

export type { ExtractRatesOptions } from '../../shared/parserInvoke'
export { parseClaudeResponseText } from '../../shared/parserInvoke'
export type { ExtractionProgress, ExtractionPropertyComplete } from '../../shared/types'

export type ExtractionProgressCallback = (progress: ExtractionProgress) => void
export type ExtractionPropertyCompleteCallback = (payload: ExtractionPropertyComplete) => void

function slimExtractionOptions(options?: ExtractRatesOptions): ExtractRatesOptions | undefined {
  if (!options?.peCatalog?.length) return options
  if (!options.targetPeSupplierId) return options
  return {
    ...options,
    peCatalog: filterPeCatalogForExtraction(options.peCatalog, options),
  }
}

export async function discoverSuppliers(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  peCatalog: Supplier[],
  anchorTerm: string,
): Promise<SupplierDiscoveryResult> {
  const proxy = await resolveParserProxyConfig()
  if (proxy?.url) {
    return discoverViaProxy(ratePDF, contractForm, peCatalog, anchorTerm)
  }

  const userText = buildDiscoveryUserText(peCatalog, anchorTerm)
  const raw = await invokeClaude(DISCOVERY_PROMPT, ratePDF, contractForm, userText)
  return normalizeDiscoveryResult(raw, anchorTerm)
}

export async function extractRates(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  options?: ExtractRatesOptions,
): Promise<ExtractionBatchResult> {
  const slimOptions = slimExtractionOptions(options)
  const proxy = await resolveParserProxyConfig()
  if (proxy?.url) {
    return extractViaProxy(ratePDF, contractForm, slimOptions)
  }

  const raw = await invokeClaude(
    SYSTEM_PROMPT,
    ratePDF,
    contractForm,
    buildExtractionUserText(slimOptions),
  )
  return normalizeExtractionBatch(raw)
}

function supplierNameForTarget(peCatalog: Supplier[], peSupplierId: number): string {
  return peCatalog.find((s) => s.supplier_id === peSupplierId)?.name ?? `PE ${peSupplierId}`
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return

  let index = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      await worker(items[current]!)
    }
  })

  await Promise.all(runners)
}

/** Run targeted per-supplier extraction for each mapped PE ID (avoids bulk truncation). */
export async function extractRatesForMappings(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  peCatalog: Supplier[],
  targets: Array<{ peSupplierId: number; propertyLabel?: string }>,
  onProgress?: ExtractionProgressCallback,
  onPropertyComplete?: ExtractionPropertyCompleteCallback,
): Promise<Record<number, ExtractionResult>> {
  const byPeId: Record<number, ExtractionResult> = {}
  const uniqueTargets = [
    ...new Map(targets.map((t) => [t.peSupplierId, t] as const)).values(),
  ]

  if (uniqueTargets.length > MAX_PROPERTIES_PER_RUN) {
    throw new Error(
      `Select at most ${MAX_PROPERTIES_PER_RUN} properties per batch. Received ${uniqueTargets.length}.`,
    )
  }

  const pdfHash = hashPdfPair(ratePDF, contractForm)
  const total = uniqueTargets.length
  let completedCount = 0
  let inFlightCount = 0
  let abortError: Error | null = null

  const proxy = await resolveParserProxyConfig()
  const concurrency = proxy?.url
    ? MAX_CONCURRENT_PROXY_EXTRACTIONS
    : MAX_CONCURRENT_EXTRACTIONS

  const reportProgress = (
    peSupplierId: number,
    supplierName: string,
    status: ExtractionProgress['status'],
  ) => {
    onProgress?.({
      current: Math.min(completedCount + inFlightCount, total),
      total,
      peSupplierId,
      supplierName,
      status,
    })
  }

  const processTarget = async (target: (typeof uniqueTargets)[number]) => {
    if (abortError) return

    const supplierName = supplierNameForTarget(peCatalog, target.peSupplierId)

    const cached = await getCachedExtraction(pdfHash, target.peSupplierId)
    if (cached) {
      const extraction = { ...cached, peSupplierId: target.peSupplierId }
      byPeId[target.peSupplierId] = extraction
      completedCount++
      onProgress?.({
        current: completedCount,
        total,
        peSupplierId: target.peSupplierId,
        supplierName,
        status: 'cached',
      })
      onPropertyComplete?.({
        peSupplierId: target.peSupplierId,
        extraction,
        completed: completedCount,
        total,
      })
      return
    }

    inFlightCount++
    reportProgress(target.peSupplierId, supplierName, 'extracting')

    try {
      const batch = await extractRates(ratePDF, contractForm, {
        peCatalog,
        targetPeSupplierId: target.peSupplierId,
        targetPropertyLabel: target.propertyLabel,
      })
      const match =
        batch.suppliers.find((s) => s.peSupplierId === target.peSupplierId) ??
        batch.suppliers[0]
      if (match) {
        const extraction = { ...match, peSupplierId: target.peSupplierId }
        byPeId[target.peSupplierId] = extraction
        await setCachedExtraction(pdfHash, target.peSupplierId, extraction)
        completedCount++
        onPropertyComplete?.({
          peSupplierId: target.peSupplierId,
          extraction,
          completed: completedCount,
          total,
        })
      }
    } catch (err) {
      abortError = err instanceof Error ? err : new Error(String(err))
    } finally {
      inFlightCount--
    }
  }

  await mapWithConcurrency(uniqueTargets, concurrency, processTarget)

  if (abortError) {
    throw abortError
  }

  const missing = uniqueTargets
    .map((t) => t.peSupplierId)
    .filter((id) => !byPeId[id])
  if (missing.length > 0) {
    const names = missing
      .map((id) => supplierNameForTarget(peCatalog, id))
      .join(', ')
    throw new Error(
      `Could not extract rates for ${missing.length} supplier(s): ${names}. Retry extraction.`,
    )
  }

  return byPeId
}
