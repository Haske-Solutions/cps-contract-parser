import { describe, it, expect } from 'vitest'
import {
  buildCiorRows,
  calculateCiorChildCost,
  findCiorBaseRates,
  ciorRateTypeCode,
} from '../main/services/ciorCalculator'
import { baseExtraction, mockCiorPolicy, mockConfirmedCior, mockExtractedRate } from './fixtures'
import { buildRows } from '../main/services/exportService'
import { buildSession, mockServiceMatch } from './fixtures'

describe('ciorCalculator', () => {
  it('calculates 75% of PPS', () => {
    const cost = calculateCiorChildCost(mockCiorPolicy, mockExtractedRate)
    expect(cost).toBe(262.5)
  })

  it('matches base rates when PE service says Family Suite but PDF room type is Family Tent', () => {
    const policy = {
      ...mockCiorPolicy,
      peServicesAffected: ['FB CIOR Family Suite'],
    }
    const rates = [
      {
        ...mockExtractedRate,
        roomType: 'Family Tent',
        mealBasis: 'FB',
        rateAmount: 400,
      },
    ]

    const matched = findCiorBaseRates(rates, policy)

    expect(matched).toHaveLength(1)
    expect(matched[0]?.roomType).toBe('Family Tent')
  })

  it('emits one CIOR row per matching seasonal base rate', () => {
    const policy = {
      ...mockCiorPolicy,
      peServicesAffected: ['FB CIOR Family Suite'],
      calculationApplied: '50% of PPS adult rate',
    }
    const extraction = {
      ...baseExtraction,
      policies: [policy],
      rates: [
        { ...mockExtractedRate, roomType: 'Family Tent', mealBasis: 'FB', rateAmount: 464, validFrom: '2026-01-01', validTo: '2026-03-31', seasonName: 'High' },
        { ...mockExtractedRate, roomType: 'Family Tent', mealBasis: 'FB', rateAmount: 300, validFrom: '2026-04-01', validTo: '2026-06-30', seasonName: 'Mid' },
        { ...mockExtractedRate, roomType: 'Family Tent', mealBasis: 'FB', rateAmount: 688, validFrom: '2026-07-01', validTo: '2026-09-30', seasonName: 'Peak' },
      ],
    }

    const rows = buildCiorRows(extraction, [mockConfirmedCior])

    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.childCost)).toEqual([232, 150, 344])
    expect(rows.every((r) => r.rateTypeCode === 'PPPN')).toBe(true)
  })

  it('always uses PPPN as the CIOR rate plan even when base rate has an invalid type code', () => {
    expect(ciorRateTypeCode({ ...mockExtractedRate, rateTypeCode: 'Policy' })).toBe('PPPN')
    expect(ciorRateTypeCode({ ...mockExtractedRate, rateCode: 'CIOR' })).toBe('PPPN')
  })

  it('writes PPPN ratePlan on exported CIOR rows', () => {
    const session = buildSession({
      extraction: {
        ...baseExtraction,
        policies: [
          {
            ...mockCiorPolicy,
            peServicesAffected: ['FB CIOR Deluxe Double'],
          },
        ],
        rates: [mockExtractedRate],
      },
      confirmedPolicies: [mockConfirmedCior],
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const ciorRow = rateRows.find((r) => r.adultBuy === 0 && r.childCost > 0)

    expect(ciorRow?.rateCode).toBe('PPPN')
    expect(ciorRow?.ratePlan).toBe('PPPN')
  })
})
