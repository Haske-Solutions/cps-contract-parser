import type { ExtractedRate, ExtrasRow, PriorRate, RateRow } from '@shared/types'

export const RATE_ROW_EDITABLE_KEYS = new Set<keyof RateRow>([
  'dateFrom',
  'dateTo',
  'rateCode',
  'rateName',
  'ratePlan',
  'adultBuy',
  'adultSell',
  'childCost',
  'childSell',
  'minPax',
  'maxPax',
  'minStay',
  'maxStay',
  'isException',
])

export const EXTRAS_ROW_EDITABLE_KEYS = new Set<keyof ExtrasRow>([
  'dateFrom',
  'dateTo',
  'rateCode',
  'rateName',
  'extraName',
  'cost',
  'sell',
  'pricePercent',
])

export const EXTRACTED_RATE_EDITABLE_KEYS = new Set<keyof ExtractedRate>([
  'propertyName',
  'roomType',
  'seasonName',
  'validFrom',
  'validTo',
  'rateAmount',
  'currency',
  'rateCode',
  'mealBasis',
  'notes',
])

export const PRIOR_RATE_EDITABLE_KEYS = new Set<keyof PriorRate>([
  'serviceName',
  'adultCost',
])

export function isRateRowKeyEditable(key: keyof RateRow): boolean {
  return RATE_ROW_EDITABLE_KEYS.has(key)
}

export function isExtrasRowKeyEditable(key: keyof ExtrasRow): boolean {
  return EXTRAS_ROW_EDITABLE_KEYS.has(key)
}

export function isExtractedRateKeyEditable(key: keyof ExtractedRate): boolean {
  return EXTRACTED_RATE_EDITABLE_KEYS.has(key)
}

export function isPriorRateKeyEditable(key: keyof PriorRate): boolean {
  return PRIOR_RATE_EDITABLE_KEYS.has(key)
}
