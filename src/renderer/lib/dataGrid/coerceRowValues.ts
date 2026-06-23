import type { ExtractedRate, ExtrasRow, RateRow } from '@shared/types'
import { parseBooleanInput, parseNumberInput } from './formatters'
import type { WithGridId } from './types'
import type { PriorRateWithNew } from '@shared/rateComparison'

const RATE_NUMERIC_KEYS = new Set([
  'adultBuy',
  'adultSell',
  'childCost',
  'childSell',
  'minPax',
  'maxPax',
  'minStay',
  'maxStay',
  'supplierId',
  'serviceId',
  'agentGroupId',
  'markup',
  'supplierCommission',
])

const EXTRAS_NUMERIC_KEYS = new Set(['cost', 'sell', 'pricePercent', 'supplierId', 'parentServiceId', 'agentGroupId'])

const EXTRACTED_NUMERIC_KEYS = new Set(['rateAmount', 'singleSupplement'])

export function coerceRateRow(
  row: WithGridId<RateRow>,
  columnKey: string,
): WithGridId<RateRow> {
  const key = columnKey as keyof RateRow
  const value = row[key]
  if (key === 'isException' && typeof value === 'string') {
    return { ...row, isException: parseBooleanInput(value) }
  }
  if (key === 'api' && typeof value === 'string') {
    return { ...row, api: parseBooleanInput(value) }
  }
  if (RATE_NUMERIC_KEYS.has(columnKey) && typeof value === 'string') {
    return { ...row, [key]: parseNumberInput(value, row[key] as number) }
  }
  return row
}

export function coerceExtrasRow(
  row: WithGridId<ExtrasRow>,
  columnKey: string,
): WithGridId<ExtrasRow> {
  const key = columnKey as keyof ExtrasRow
  const value = row[key]
  const boolKeys = new Set([
    'childOnly',
    'infantOnly',
    'markup',
    'discount',
    'mandatory',
    'noReport',
    'commission',
    'capacityChange',
    'percentFromChildPrice',
    'noVoucher',
  ])
  if (boolKeys.has(columnKey) && typeof value === 'string') {
    return { ...row, [key]: parseBooleanInput(value) as ExtrasRow[keyof ExtrasRow] }
  }
  if (EXTRAS_NUMERIC_KEYS.has(columnKey) && typeof value === 'string') {
    const fallback = typeof row[key] === 'number' ? (row[key] as number) : 0
    return { ...row, [key]: parseNumberInput(value, fallback) }
  }
  return row
}

export function coerceExtractedRate(
  row: WithGridId<ExtractedRate>,
  columnKey: string,
): WithGridId<ExtractedRate> {
  const key = columnKey as keyof ExtractedRate
  const value = row[key]
  if (EXTRACTED_NUMERIC_KEYS.has(columnKey) && typeof value === 'string') {
    const fallback = typeof row[key] === 'number' ? (row[key] as number) : 0
    return { ...row, [key]: parseNumberInput(value, fallback) }
  }
  return row
}

const PRIOR_RATE_NUMERIC_KEYS = new Set(['adultCost', 'childCost'])

export function coercePriorRate(
  row: WithGridId<PriorRateWithNew>,
  columnKey: string,
): WithGridId<PriorRateWithNew> {
  const key = columnKey as keyof PriorRateWithNew
  const value = row[key]
  if (PRIOR_RATE_NUMERIC_KEYS.has(columnKey) && typeof value === 'string') {
    const fallback = typeof row[key] === 'number' ? (row[key] as number) : 0
    return { ...row, [key]: parseNumberInput(value, fallback) }
  }
  return row
}
