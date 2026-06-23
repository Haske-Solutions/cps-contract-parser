import type { ConfirmedPolicy, ExtractedPolicy, ExtractedRate, ExtractionResult } from '../../shared/types'

export interface CiorRowInput {
  rateTypeCode: string
  childCost: number
  validFrom: string
  validTo: string
  minPax: number
  serviceName: string
}

const PERCENT_RE = /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:pps|per\s+person|adult|dbl|double|twin)?/i
const FIXED_RE = /(?:fixed|amount|rate)\s*[:=]?\s*\$?\s*(\d+(?:\.\d+)?)/i

export function parseCiorFormula(calculationApplied: string): {
  type: 'percent' | 'fixed' | 'unknown'
  value: number
} {
  const pct = calculationApplied.match(PERCENT_RE)
  if (pct) return { type: 'percent', value: Number(pct[1]) / 100 }

  const fixed = calculationApplied.match(FIXED_RE)
  if (fixed) return { type: 'fixed', value: Number(fixed[1]) }

  const bare = calculationApplied.match(/\b(\d+(?:\.\d+)?)\s*%/)
  if (bare) return { type: 'percent', value: Number(bare[1]) / 100 }

  return { type: 'unknown', value: 0 }
}

export function findBasePpsRate(
  rates: ExtractedRate[],
  mealBasis?: string,
  roomType?: string,
): ExtractedRate | undefined {
  return rates.find(
    (r) =>
      !r.isNonAccommodation &&
      r.rateCode.toUpperCase() !== 'CIOR' &&
      (mealBasis ? r.mealBasis.toUpperCase().includes(mealBasis.toUpperCase()) : true) &&
      (roomType ? r.roomType.toLowerCase().includes(roomType.toLowerCase()) : true) &&
      r.rateAmount > 0,
  )
}

export function calculateCiorChildCost(
  policy: ExtractedPolicy,
  baseRate: ExtractedRate | undefined,
): number {
  if (!baseRate) return 0
  const formula = parseCiorFormula(policy.calculationApplied)
  if (formula.type === 'percent') return Math.round(baseRate.rateAmount * formula.value * 100) / 100
  if (formula.type === 'fixed') return formula.value
  return 0
}

export function buildCiorRows(
  extraction: ExtractionResult,
  confirmedPolicies: ConfirmedPolicy[],
): CiorRowInput[] {
  const ciorPolicy = extraction.policies.find((p) => p.type === 'CIOR')
  const confirmed = confirmedPolicies.find((cp) => cp.type === 'CIOR')
  if (!ciorPolicy || !confirmed?.confirmed) return []

  const base = findBasePpsRate(extraction.rates, undefined, undefined)
  const childCost = calculateCiorChildCost(ciorPolicy, base)
  const rateTypeCode = base?.rateTypeCode ?? base?.rateCode ?? 'PPPN'

  const serviceName =
    ciorPolicy.peServicesAffected[0] ??
    (base ? `${base.mealBasis} CIOR ${base.roomType}` : 'CIOR')

  return [
    {
      rateTypeCode: rateTypeCode.toUpperCase() === 'CIOR' ? 'PPPN' : rateTypeCode,
      childCost,
      validFrom: base?.validFrom ?? extraction.contractPeriod.from,
      validTo: base?.validTo ?? extraction.contractPeriod.to,
      minPax: 2,
      serviceName,
    },
  ]
}
