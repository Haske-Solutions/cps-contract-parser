import type { ConfirmedPolicy, ExtractedPolicy, ExtractedRate, ExtractionResult } from '../../shared/types'
import { scoreServiceRefAgainstRate } from '../../shared/serviceTokenMatcher'

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
const CIOR_BASE_MATCH_THRESHOLD = 0.5

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

export function ciorServiceReference(policy: ExtractedPolicy): string {
  return (policy.peServicesAffected[0] ?? '').trim()
}

function isEligibleBaseRate(rate: ExtractedRate): boolean {
  return (
    !rate.isNonAccommodation &&
    rate.rateCode.toUpperCase() !== 'CIOR' &&
    rate.rateAmount > 0
  )
}

export function findBasePpsRate(
  rates: ExtractedRate[],
  mealBasis?: string,
  roomType?: string,
): ExtractedRate | undefined {
  return rates.find(
    (r) =>
      isEligibleBaseRate(r) &&
      (mealBasis ? r.mealBasis.toUpperCase().includes(mealBasis.toUpperCase()) : true) &&
      (roomType ? r.roomType.toLowerCase().includes(roomType.toLowerCase()) : true),
  )
}

export function findCiorBaseRates(rates: ExtractedRate[], policy: ExtractedPolicy): ExtractedRate[] {
  const serviceRef = ciorServiceReference(policy)
  const eligible = rates.filter(isEligibleBaseRate)

  if (!serviceRef) {
    return eligible
  }

  const scored = eligible
    .map((rate) => ({ rate, score: scoreServiceRefAgainstRate(serviceRef, rate) }))
    .filter((entry) => entry.score >= CIOR_BASE_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) return []

  const topScore = scored[0]?.score ?? 0
  return scored.filter((entry) => entry.score === topScore).map((entry) => entry.rate)
}

export function ciorRateTypeCode(_baseRate?: ExtractedRate): string {
  return 'PPPN'
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

  const baseRates = findCiorBaseRates(extraction.rates, ciorPolicy)
  const serviceName =
    ciorServiceReference(ciorPolicy) ||
    (baseRates[0] ? `${baseRates[0].mealBasis} CIOR ${baseRates[0].roomType}` : 'CIOR')

  if (baseRates.length === 0) {
    return [
      {
        rateTypeCode: ciorRateTypeCode(),
        childCost: 0,
        validFrom: extraction.contractPeriod.from,
        validTo: extraction.contractPeriod.to,
        minPax: 2,
        serviceName,
      },
    ]
  }

  return baseRates.map((base) => ({
    rateTypeCode: ciorRateTypeCode(base),
    childCost: calculateCiorChildCost(ciorPolicy, base),
    validFrom: base.validFrom,
    validTo: base.validTo,
    minPax: 2,
    serviceName,
  }))
}
