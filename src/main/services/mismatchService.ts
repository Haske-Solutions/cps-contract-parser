import { collectMismatches } from '../../shared/mismatchCollector'
import type { ExtractionResult, Mismatch } from '../../shared/types'

export function detectMismatches(extraction: ExtractionResult): Mismatch[] {
  return collectMismatches(extraction)
}
