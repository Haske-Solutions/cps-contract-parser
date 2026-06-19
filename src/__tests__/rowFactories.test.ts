import { describe, expect, it } from 'vitest'
import {
  createEmptyExtractedRate,
  createEmptyRateRow,
  createEmptyExtrasRow,
  createEmptyServiceMatch,
  createEmptyPriorRate,
} from '../renderer/lib/dataGrid/rowFactories'
import {
  MIN_PAX_FALLBACK,
  MAX_PAX_FALLBACK,
  MIN_STAY_FALLBACK,
  MAX_STAY_FALLBACK,
} from '@shared/constants'

describe('rowFactories', () => {
  it('createEmptyExtractedRate applies seed values', () => {
    const row = createEmptyExtractedRate({
      propertyName: 'Serengeti Camp',
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      currency: 'EUR',
      mealBasis: 'Half Board',
      rateCode: 'SGL',
    })

    expect(row.propertyName).toBe('Serengeti Camp')
    expect(row.validFrom).toBe('2026-01-01')
    expect(row.validTo).toBe('2026-12-31')
    expect(row.currency).toBe('EUR')
    expect(row.mealBasis).toBe('Half Board')
    expect(row.rateCode).toBe('SGL')
    expect(row.rateAmount).toBe(0)
    expect(row.childRates).toEqual([])
  })

  it('createEmptyRateRow copies supplier and date fields from template', () => {
    const row = createEmptyRateRow({
      supplierName: 'Acme Safaris',
      supplierId: 42,
      supplierCode: 'ACM',
      validFrom: '2026-06-01',
      validTo: '2027-05-31',
      ratePlan: 'Rack',
      rateCode: 'DBL',
      minPax: 1,
      maxPax: 4,
    })

    expect(row.supplierName).toBe('Acme Safaris')
    expect(row.supplierId).toBe(42)
    expect(row.supplierCode).toBe('ACM')
    expect(row.validFrom).toBe('2026-06-01')
    expect(row.validTo).toBe('2027-05-31')
    expect(row.ratePlan).toBe('Rack')
    expect(row.rateCode).toBe('DBL')
    expect(row.minPax).toBe(1)
    expect(row.maxPax).toBe(4)
    expect(row.service).toBe('')
    expect(row.adultBuy).toBe(0)
  })

  it('createEmptyRateRow uses fallbacks when no template is provided', () => {
    const row = createEmptyRateRow()

    expect(row.minPax).toBe(MIN_PAX_FALLBACK)
    expect(row.maxPax).toBe(MAX_PAX_FALLBACK)
    expect(row.minStay).toBe(MIN_STAY_FALLBACK)
    expect(row.maxStay).toBe(MAX_STAY_FALLBACK)
    expect(row.rateCode).toBe('DBL')
  })

  it('createEmptyExtrasRow copies category defaults from template', () => {
    const row = createEmptyExtrasRow({
      supplierName: 'Acme Safaris',
      extraCategory: 'Park Fee',
      priceType: 'per_vehicle',
    })

    expect(row.supplierName).toBe('Acme Safaris')
    expect(row.extraCategory).toBe('Park Fee')
    expect(row.priceType).toBe('per_vehicle')
    expect(row.rateCode).toBe('CHD')
  })

  it('createEmptyServiceMatch creates a needs_creation row', () => {
    const row = createEmptyServiceMatch()

    expect(row.extractedName).toBe('')
    expect(row.peServiceId).toBeNull()
    expect(row.status).toBe('needs_creation')
    expect(row.candidates).toEqual([])
  })

  it('createEmptyPriorRate creates a blank prior rate row', () => {
    const row = createEmptyPriorRate({
      serviceName: 'Deluxe Tent',
      currency: 'EUR',
      childCost: 120,
    })

    expect(row.serviceName).toBe('Deluxe Tent')
    expect(row.adultCost).toBe(0)
    expect(row.childCost).toBe(120)
    expect(row.currency).toBe('EUR')
    expect(row.percentChange).toBeNull()
    expect(row.logTimestamp).toBeTruthy()
  })
})
