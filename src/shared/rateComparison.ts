import type { ExtractionResult, ExtractedRate, PriorRate, ServiceMatch } from './types'
import { rateRecordKey } from './serviceTokenMatcher'
import { RATE_CHANGE_THRESHOLD_PCT } from './constants'

export interface PriorRateWithNew extends PriorRate {
  newRate: number | null
}

export function computePercentChange(
  priorCost: number,
  newRate: number | null,
): number | null {
  if (newRate === null || priorCost === 0) return null
  return ((newRate - priorCost) / priorCost) * 100
}

/** Keep the most recent pricing history row per service name. */
export function dedupePriorRates(priorRates: PriorRate[]): PriorRate[] {
  const byService = new Map<string, PriorRate>()

  for (const rate of priorRates) {
    const key = rate.serviceName.toLowerCase()
    const existing = byService.get(key)
    if (!existing || rate.logTimestamp > existing.logTimestamp) {
      byService.set(key, rate)
    }
  }

  return [...byService.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName))
}

function findExtractedRateForMatch(
  extraction: ExtractionResult,
  match: ServiceMatch,
): ExtractedRate | undefined {
  if (match.rateRecordKey) {
    const byKey = extraction.rates.find((rate) => rateRecordKey(rate) === match.rateRecordKey)
    if (byKey) return byKey
  }

  const names = [match.extractedName, match.peServiceName]
    .filter((name): name is string => Boolean(name))
    .map((name) => name.toLowerCase())

  return extraction.rates.find((rate) => {
    const room = rate.roomType.toLowerCase()
    const full = `${rate.propertyName} ${rate.roomType}`.toLowerCase()
    const property = rate.propertyName.toLowerCase()
    return names.some((name) => name === room || name === full || name === property)
  })
}

function buildRateByServiceName(
  extraction: ExtractionResult,
  serviceMatches: ServiceMatch[],
): Map<string, number> {
  const map = new Map<string, number>()

  for (const rate of extraction.rates) {
    map.set(rate.roomType.toLowerCase(), rate.rateAmount)
    map.set(`${rate.propertyName} ${rate.roomType}`.toLowerCase(), rate.rateAmount)
  }

  for (const match of serviceMatches) {
    const extracted = findExtractedRateForMatch(extraction, match)
    if (!extracted) continue

    map.set(match.extractedName.toLowerCase(), extracted.rateAmount)
    if (match.peServiceName) {
      map.set(match.peServiceName.toLowerCase(), extracted.rateAmount)
    }
  }

  return map
}

/**
 * Map prior rates to new extraction rates by service name (case-insensitive).
 */
export function enrichPriorRatesWithNew(
  priorRates: PriorRate[],
  extraction: ExtractionResult | null,
  serviceMatches: ServiceMatch[],
): PriorRateWithNew[] {
  const deduped = dedupePriorRates(priorRates)

  if (!extraction) {
    return deduped.map((rate) => ({ ...rate, newRate: null }))
  }

  const rateByServiceName = buildRateByServiceName(extraction, serviceMatches)

  return deduped.map((prior) => {
    const newRate = rateByServiceName.get(prior.serviceName.toLowerCase()) ?? null
    const percentChange = computePercentChange(prior.adultCost, newRate)
    return { ...prior, newRate, percentChange }
  })
}

export function isHighRateChange(prior: Pick<PriorRateWithNew, 'percentChange'>): boolean {
  return (
    prior.percentChange !== null &&
    Math.abs(prior.percentChange) > RATE_CHANGE_THRESHOLD_PCT
  )
}

/**
 * Service IDs flagged for rate change highlighting in Excel preview.
 */
export function computeRateChangeServiceIds(
  priorRates: PriorRateWithNew[],
  serviceMatches: ServiceMatch[],
): Set<number> {
  const ids = new Set<number>()

  for (const prior of priorRates) {
    if (!isHighRateChange(prior)) continue

    const match = serviceMatches.find(
      (m) =>
        m.peServiceName?.toLowerCase() === prior.serviceName.toLowerCase() ||
        m.extractedName.toLowerCase() === prior.serviceName.toLowerCase(),
    )
    if (match?.peServiceId != null) {
      ids.add(match.peServiceId)
    }
  }

  return ids
}
