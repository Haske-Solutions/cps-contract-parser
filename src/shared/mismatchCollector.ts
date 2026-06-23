import { normalizeAmountForCompare } from './peFormat'
import type { ExtractionResult, Mismatch } from './types'

let mismatchSeq = 0

function nextId(): string {
  mismatchSeq += 1
  return `mismatch-${mismatchSeq}`
}

export function resetMismatchSeq(): void {
  mismatchSeq = 0
}

function amountsDiffer(form: string | number, pdf: string | number): boolean {
  const f = normalizeAmountForCompare(form)
  const p = normalizeAmountForCompare(pdf)
  if (f === null || p === null) return String(form).trim() !== String(pdf).trim()
  return f !== p
}

export function collectMismatches(extraction: ExtractionResult): Mismatch[] {
  const seen = new Set<string>()
  const mismatches: Mismatch[] = []

  const add = (
    section: string,
    field: string,
    formValue: string,
    pdfValue: string,
    rateRef?: string,
  ) => {
    const id = `${section}:${field}:${rateRef ?? formValue}:${pdfValue}`
    if (seen.has(id)) return
    seen.add(id)
    mismatches.push({
      id: nextId(),
      section,
      field: rateRef ? `${field} — ${rateRef}` : field,
      formValue: formValue.trim(),
      pdfValue: pdfValue.trim(),
      resolved: false,
      resolution: null,
      otherNote: null,
    })
  }

  for (const cc of extraction.crossChecks ?? []) {
    if (amountsDiffer(cc.formValue, cc.pdfValue) || cc.formValue.trim() !== cc.pdfValue.trim()) {
      add(cc.section, cc.field, cc.formValue, cc.pdfValue, cc.rateRef)
    }
  }

  for (const rate of extraction.rates) {
    if (!rate.notes) continue
    const conflict = rate.notes.match(
      /(?:form|contract)[:\s]+([^|/]+?)(?:\s*(?:vs?\.?|\/|\|)\s*(?:pdf|rate\s*sheet)[:\s]+(.+?))(?:\s*$|[.;])/i,
    )
    if (conflict) {
      const ref = `${rate.propertyName} — ${rate.roomType} (${rate.validFrom})`
      add('Accommodation', 'Rate amount', conflict[1], conflict[2], ref)
    }
  }

  for (const na of extraction.nonAccommodationRates ?? []) {
    if (!na.notes) continue
    const conflict = na.notes.match(
      /(?:form|contract)[:\s]+([^|/]+?)(?:\s*(?:vs?\.?|\/|\|)\s*(?:pdf|rate\s*sheet)[:\s]+(.+?))(?:\s*$|[.;])/i,
    )
    if (conflict) {
      add('Non-Accommodation', na.description, conflict[1], conflict[2], na.description)
    }
  }

  for (const pf of extraction.parkFees ?? []) {
    if (!pf.name) continue
    // crossChecks from LLM carry park fee mismatches; notes on park fees optional
  }

  return mismatches
}

export function applyMismatchResolution(
  fieldKey: string,
  formValue: string,
  _pdfValue: string,
  resolutions: { id: string; field: string; chosenValue: string; resolution: string }[],
): string {
  const r = resolutions.find((res) => res.field === fieldKey || res.id === fieldKey)
  if (r) return r.chosenValue
  return formValue
}

export function resolveAmount(
  mismatchId: string,
  formValue: string,
  pdfValue: string,
  resolutions: { id: string; chosenValue: string; resolution: string }[],
): string {
  const r = resolutions.find((res) => res.id === mismatchId)
  if (!r) return formValue
  if (r.resolution === 'use_pdf') return pdfValue
  if (r.resolution === 'use_form') return r.chosenValue || formValue
  return r.chosenValue
}
