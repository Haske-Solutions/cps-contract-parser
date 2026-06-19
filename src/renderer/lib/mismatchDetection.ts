import type { ExtractionResult, Mismatch } from '@shared/types'

const CONFLICT_PATTERN =
  /(?:form|contract)[:\s]+([^|/]+?)(?:\s*(?:vs?\.?|\/|\|)\s*(?:pdf|rate\s*sheet)[:\s]+(.+?))(?:\s*$|[.;])/i

/**
 * Detect form vs PDF discrepancies from extraction notes (v1).
 * Scans rate notes and top-level extraction notes for explicit conflict markers.
 */
export function detectMismatches(extraction: ExtractionResult): Mismatch[] {
  const seen = new Set<string>()
  const mismatches: Mismatch[] = []

  const addMismatch = (field: string, formValue: string, pdfValue: string) => {
    const key = `${field}|${formValue}|${pdfValue}`
    if (seen.has(key)) return
    seen.add(key)
    mismatches.push({
      field,
      formValue: formValue.trim(),
      pdfValue: pdfValue.trim(),
      resolved: false,
      resolution: null,
      otherNote: null,
    })
  }

  for (const rate of extraction.rates) {
    if (!rate.notes) continue
    const match = rate.notes.match(CONFLICT_PATTERN)
    if (match) {
      addMismatch(
        `${rate.propertyName} — ${rate.roomType} (${rate.validFrom})`,
        match[1],
        match[2],
      )
    }
  }

  return mismatches
}
