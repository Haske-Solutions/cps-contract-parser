import { describe, it, expect } from 'vitest'
import {
  RATE_ROW_EDITABLE_KEYS,
  EXTRAS_ROW_EDITABLE_KEYS,
  EXTRACTED_RATE_EDITABLE_KEYS,
  isRateRowKeyEditable,
} from '../renderer/lib/dataGrid/editability'

describe('editability allowlists', () => {
  it('allows editing rate amounts and dates on RateRow', () => {
    expect(isRateRowKeyEditable('adultBuy')).toBe(true)
    expect(isRateRowKeyEditable('validFrom')).toBe(true)
    expect(isRateRowKeyEditable('supplierId')).toBe(false)
    expect(isRateRowKeyEditable('api')).toBe(false)
  })

  it('includes extras-specific fields', () => {
    expect(EXTRAS_ROW_EDITABLE_KEYS.has('extraCategory')).toBe(true)
    expect(EXTRAS_ROW_EDITABLE_KEYS.has('priceType')).toBe(true)
    expect(RATE_ROW_EDITABLE_KEYS.has('ratePlan')).toBe(true)
  })

  it('includes extracted rate parser fields', () => {
    expect(EXTRACTED_RATE_EDITABLE_KEYS.has('propertyName')).toBe(true)
    expect(EXTRACTED_RATE_EDITABLE_KEYS.has('rateAmount')).toBe(true)
    expect(EXTRACTED_RATE_EDITABLE_KEYS.has('childRates')).toBe(false)
  })
})
