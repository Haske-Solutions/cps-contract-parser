import type {
  ExtractionBatchResult,
  Supplier,
  SupplierDiscoveryResult,
} from '../../shared/types'
import { MAX_PROPERTIES_PER_RUN } from '../../shared/constants'
import {
  buildDiscoveryUserText,
  buildExtractionUserText,
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

export type { ExtractRatesOptions } from '../../shared/parserInvoke'
export { parseClaudeResponseText } from '../../shared/parserInvoke'

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
  const proxy = await resolveParserProxyConfig()
  if (proxy?.url) {
    return extractViaProxy(ratePDF, contractForm, options)
  }

  const raw = await invokeClaude(
    SYSTEM_PROMPT,
    ratePDF,
    contractForm,
    buildExtractionUserText(options),
  )
  return normalizeExtractionBatch(raw)
}

/** Run targeted per-supplier extraction for each mapped PE ID (avoids bulk truncation). */
export async function extractRatesForMappings(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  peCatalog: Supplier[],
  targets: Array<{ peSupplierId: number; propertyLabel?: string }>,
): Promise<Record<number, import('../../shared/types').ExtractionResult>> {
  const byPeId: Record<number, import('../../shared/types').ExtractionResult> = {}
  const uniqueTargets = [
    ...new Map(targets.map((t) => [t.peSupplierId, t] as const)).values(),
  ]

  if (uniqueTargets.length > MAX_PROPERTIES_PER_RUN) {
    throw new Error(
      `Select at most ${MAX_PROPERTIES_PER_RUN} properties per batch. Received ${uniqueTargets.length}.`,
    )
  }

  for (const target of uniqueTargets) {
    const batch = await extractRates(ratePDF, contractForm, {
      peCatalog,
      targetPeSupplierId: target.peSupplierId,
      targetPropertyLabel: target.propertyLabel,
    })
    const match =
      batch.suppliers.find((s) => s.peSupplierId === target.peSupplierId) ??
      batch.suppliers[0]
    if (match) {
      byPeId[target.peSupplierId] = { ...match, peSupplierId: target.peSupplierId }
    }
  }

  const missing = uniqueTargets
    .map((t) => t.peSupplierId)
    .filter((id) => !byPeId[id])
  if (missing.length > 0) {
    const names = missing
      .map((id) => peCatalog.find((s) => s.supplier_id === id)?.name ?? `PE ${id}`)
      .join(', ')
    throw new Error(
      `Could not extract rates for ${missing.length} supplier(s): ${names}. Retry extraction.`,
    )
  }

  return byPeId
}
