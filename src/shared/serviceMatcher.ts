import type { ExtractedRate, PEService, ServiceMatch } from './types'
import { matchRateToServices, rateRecordKey } from './serviceTokenMatcher'

export function matchAccommodationRates(
  rates: ExtractedRate[],
  inventory: PEService[],
): ServiceMatch[] {
  const accommodationRates = rates.filter((r) => !r.isNonAccommodation)
  return accommodationRates.map((rate) => {
    const result = matchRateToServices(rate, inventory, 'accommodation')
    const key = rateRecordKey(rate)
    if (result.status === 'matched' && result.service) {
      return {
        extractedName: key,
        peServiceId: result.service.id,
        peServiceName: result.service.name,
        peServiceCode: result.service.code,
        status: 'matched' as const,
        candidates: [result.service],
        bucket: 'accommodation' as const,
        rateRecordKey: key,
      }
    }
    if (result.status === 'ambiguous' || result.status === 'fuzzy_match') {
      return {
        extractedName: key,
        peServiceId: null,
        peServiceName: null,
        peServiceCode: null,
        status: 'multiple_matches' as const,
        candidates: result.candidates,
        bucket: 'accommodation' as const,
        rateRecordKey: key,
        matchConfidence: result.status === 'fuzzy_match' ? ('fuzzy' as const) : ('strict' as const),
      }
    }
    return {
      extractedName: `${rate.roomType} — ${rate.propertyName}`,
      peServiceId: null,
      peServiceName: null,
      peServiceCode: null,
      status: 'needs_creation' as const,
      candidates: [],
      bucket: 'accommodation' as const,
      rateRecordKey: key,
    }
  })
}

export function findMatchForRate(
  rate: ExtractedRate,
  matches: ServiceMatch[],
): ServiceMatch | undefined {
  const key = rateRecordKey(rate)
  return (
    matches.find((m) => m.rateRecordKey === key) ??
    matches.find(
      (m) =>
        m.extractedName.toLowerCase().includes(rate.roomType.toLowerCase()) ||
        rate.roomType.toLowerCase().includes(m.extractedName.toLowerCase()),
    )
  )
}
