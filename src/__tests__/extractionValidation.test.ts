import { describe, it, expect } from 'vitest'
import {
  normalizeExtraction,
  normalizeExtractionBatch,
  getExtractionValidationFlags,
} from '../main/services/extractionValidation'
import { baseExtraction, mockExtractedRate, mockCiorPolicy } from './fixtures'

describe('normalizeExtraction', () => {
  it('normalizes a complete extraction payload with all required fields', () => {
    const raw = {
      supplierName: 'Savanna Lodge',
      contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
      properties: ['Savanna Lodge'],
      rates: [
        {
          propertyName: 'Savanna Lodge',
          roomType: 'Deluxe Double',
          mealBasis: 'Full Board',
          seasonName: 'Peak Season',
          validFrom: '01/01/2026',
          validTo: '31/03/2026',
          rateAmount: '350',
          currency: 'USD',
          rateCode: 'dbl',
          occupancyRules: '2 adults',
          childRates: [{ ageFrom: 0, ageTo: 12, amount: 175, rateCode: 'CHD' }],
          singleSupplement: null,
          notes: '',
        },
      ],
      policies: [
        {
          type: 'CIOR',
          verbatimText: 'Children in own room free of charge',
          interpretation: 'CIOR applies',
          calculationApplied: 'adultBuy = 0',
          peServicesAffected: ['Deluxe Double'],
          confirmed: true,
        },
      ],
    }

    const result = normalizeExtraction(raw)

    expect(result.supplierName).toBe('Savanna Lodge')
    expect(result.contractPeriod.from).toBe('2026-01-01')
    expect(result.rates[0]?.validFrom).toBe('2026-01-01')
    expect(result.rates[0]?.validTo).toBe('2026-03-31')
    expect(result.rates[0]?.rateAmount).toBe(350)
    expect(result.rates[0]?.rateCode).toBe('DBL')
    expect(result.policies[0]?.confirmed).toBe(false)
  })

  it('normalizes a multi-supplier batch payload', () => {
    const raw = {
      suppliers: [
        {
          supplierName: 'Savanna Lodge',
          contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
          properties: ['Savanna Lodge'],
          rates: [mockExtractedRate],
          policies: [],
        },
        {
          supplierName: 'River Camp',
          contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
          properties: ['River Camp'],
          rates: [],
          policies: [],
        },
      ],
    }

    const result = normalizeExtractionBatch(raw)

    expect(result.suppliers).toHaveLength(2)
    expect(result.suppliers[0]?.supplierName).toBe('Savanna Lodge')
    expect(result.suppliers[1]?.supplierName).toBe('River Camp')
  })

  it('throws when suppliers array is empty', () => {
    expect(() => normalizeExtractionBatch({ suppliers: [] })).toThrow(/supplier contracts/i)
  })

  it('throws a user-friendly error when supplier name is missing', () => {
    expect(() =>
      normalizeExtraction({
        supplierName: '  ',
        contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
        properties: [],
        rates: [],
        policies: [],
      }),
    ).toThrow(/supplier name/i)
  })

  it('throws when policy type is unknown', () => {
    expect(() =>
      normalizeExtraction({
        ...baseExtraction,
        policies: [{ ...mockCiorPolicy, type: 'unknown_policy' }],
      }),
    ).toThrow(/unknown type/i)
  })
})

describe('getExtractionValidationFlags', () => {
  it('flags missing policies for CIOR awareness', () => {
    const flags = getExtractionValidationFlags(baseExtraction)
    expect(flags.some((f) => f.code === 'NO_POLICIES_EXTRACTED')).toBe(true)
  })

  it('flags ambiguous rate fields when meal basis or occupancy is empty', () => {
    const flags = getExtractionValidationFlags({
      ...baseExtraction,
      rates: [{ ...mockExtractedRate, mealBasis: '', occupancyRules: '' }],
    })
    expect(flags.some((f) => f.code === 'AMBIGUOUS_RATE_FIELDS')).toBe(true)
  })

  it('does not flag a fully populated rate row', () => {
    const flags = getExtractionValidationFlags({
      ...baseExtraction,
      policies: [mockCiorPolicy],
    })
    expect(flags.some((f) => f.code === 'AMBIGUOUS_RATE_FIELDS')).toBe(false)
  })
})
