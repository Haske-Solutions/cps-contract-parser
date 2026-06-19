import type { ExtractionBatchResult, ExtractionResult, Supplier } from './types'

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

function supplierNamesMatch(extractedName: string, selectedName: string): boolean {
  const a = normalizeName(extractedName)
  const b = normalizeName(selectedName)
  return a === b || a.includes(b) || b.includes(a)
}

export function isExtractionSuggestedForSupplier(
  extraction: ExtractionResult,
  supplier: Supplier,
): boolean {
  return supplierNamesMatch(extraction.supplierName, supplier.name)
}

export type ExtractionApplyResult =
  | { mode: 'selected'; extraction: ExtractionResult }
  | { mode: 'pick'; batch: ExtractionBatchResult }

/** Single supplier → auto-select; multiple → user must pick in the UI. */
export function resolveExtractionBatch(
  batch: ExtractionBatchResult,
): ExtractionApplyResult {
  if (batch.suppliers.length === 0) {
    throw new Error(
      'No supplier contracts were extracted from the documents. Please verify both PDFs and try again.',
    )
  }

  if (batch.suppliers.length === 1) {
    return { mode: 'selected', extraction: batch.suppliers[0] }
  }

  return { mode: 'pick', batch }
}
