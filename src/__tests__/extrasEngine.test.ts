import { describe, it, expect } from 'vitest'
import { buildExtrasRows } from '../main/services/extrasEngine'
import type { ConfirmedPolicy, ExtractedPolicy, ExtractionResult, ServiceMatch } from '../shared/types'
import {
  baseExtraction,
  extractionWithNonAccom,
  mockConfirmedCior,
  mockExtrasMatch,
  mockExtractedRate,
  mockServiceMatch,
  mockSupplier,
} from './fixtures'

const confirmedChildSharing: ConfirmedPolicy = {
  type: 'children_sharing',
  confirmed: true,
}

const childSharingPolicy: ExtractedPolicy = {
  type: 'children_sharing',
  verbatimText: 'Child policy matrix',
  interpretation: 'Tiered child sharing',
  calculationApplied: '50% with 1 adult, 25% with 2 adults',
  peServicesAffected: [],
  confirmed: false,
  childBrackets: [
    { ageFrom: 0, ageTo: 11.99, passengerType: 'child', flatCost: 0 },
    { ageFrom: 12, ageTo: 17.99, passengerType: 'child', adultsSharingWith: 1, percentOfAdult: 50 },
    { ageFrom: 12, ageTo: 17.99, passengerType: 'child', adultsSharingWith: 2, percentOfAdult: 25 },
    { ageFrom: 0, ageTo: 4.99, passengerType: 'infant', flatCost: 0 },
  ],
}

const twinMatch: ServiceMatch = {
  ...mockServiceMatch,
  peServiceName: 'FB Twin Deluxe',
  peServiceCode: 'TD001',
}

const familyMatch: ServiceMatch = {
  ...mockServiceMatch,
  peServiceId: 105,
  peServiceName: 'FB Family Villa',
  peServiceCode: 'FV001',
}

describe('extrasEngine', () => {
  it('returns empty extras when extraction has no policy or festive data', () => {
    const rows = buildExtrasRows(
      baseExtraction,
      mockSupplier,
      [mockServiceMatch],
      [],
      [],
    )

    expect(rows).toEqual([])
  })

  it('populates cost and sell from matching nonAccommodationRates', () => {
    const airportTransferMatch = {
      ...mockExtrasMatch,
      extractedName: 'Airport Transfer',
      peServiceName: 'Airport Transfer',
    }
    const rows = buildExtrasRows(
      extractionWithNonAccom,
      mockSupplier,
      [mockServiceMatch],
      [airportTransferMatch],
      [],
    )

    const transfer = rows.find((r) => r.extraName.includes('Airport Transfer'))
    expect(transfer).toBeDefined()
    expect(transfer?.cost).toBe(120)
    expect(transfer?.sell).toBe(120)
    expect(transfer?.dateFrom).toBe('2026-01-01')
    expect(transfer?.dateTo).toBe('2026-12-31')
    expect(transfer?.rateCode).toBe('PV')
  })

  it('emits separate rows per season when non-accommodation prices differ', () => {
    const extraction = {
      ...baseExtraction,
      nonAccommodationRates: [
        {
          description: 'Laundry',
          rateTypeCode: 'PPPN',
          cost: 10,
          sell: 12,
          released: true,
          validFrom: '2026-01-01',
          validTo: '2026-06-30',
          notes: '',
        },
        {
          description: 'Laundry',
          rateTypeCode: 'PPPN',
          cost: 15,
          sell: 18,
          released: true,
          validFrom: '2026-07-01',
          validTo: '2026-12-31',
          notes: '',
        },
      ],
    }

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [mockServiceMatch],
      [mockExtrasMatch],
      [],
    )

    const laundryRows = rows.filter((r) => r.extraName.includes('Laundry'))
    expect(laundryRows).toHaveLength(2)
    expect(laundryRows.map((r) => r.cost)).toEqual([10, 15])
    expect(laundryRows.map((r) => r.dateFrom)).toEqual(['2026-01-01', '2026-07-01'])
  })

  it('emits per-age-bracket child and infant sharing rows from childBrackets', () => {
    const extraction = {
      ...baseExtraction,
      policies: [childSharingPolicy],
    }

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [mockServiceMatch, twinMatch],
      [],
      [confirmedChildSharing],
    )

    const doubleRows = rows.filter((r) => r.parentServiceName === 'FB Double Deluxe')
    expect(doubleRows).toHaveLength(4)
    expect(doubleRows.map((r) => r.extraName)).toEqual(
      expect.arrayContaining([
        'Child (0 to 11.99 yrs) Sharing',
        'Child (12 to 17.99 yrs) Sharing with 1 Adult',
        'Child (12 to 17.99 yrs) Sharing with 2 Adults',
        'Infant (0 to 4.99 yrs) Sharing',
      ]),
    )
    const byName = Object.fromEntries(doubleRows.map((r) => [r.extraName, r]))
    expect(byName['Child (0 to 11.99 yrs) Sharing']?.cost).toBe(0)
    expect(byName['Child (12 to 17.99 yrs) Sharing with 1 Adult']?.pricePercent).toBe(50)
    expect(byName['Child (12 to 17.99 yrs) Sharing with 1 Adult']?.cost).toBeNull()
    expect(byName['Child (12 to 17.99 yrs) Sharing with 2 Adults']?.pricePercent).toBe(25)
    expect(byName['Infant (0 to 4.99 yrs) Sharing']?.infantOnly).toBe(true)
    expect(byName['Infant (0 to 4.99 yrs) Sharing']?.cost).toBe(0)
  })

  it('attaches infant sharing rows to Family parents but not child-sharing rows', () => {
    const extraction = {
      ...baseExtraction,
      rates: [
        {
          ...mockExtractedRate,
          roomType: 'Family Villa',
          rateCode: 'FAM',
          rateTypeCode: 'PRPN',
          occupancyRules: 'based on 4 pax',
          maxPax: 4,
        },
      ],
      policies: [childSharingPolicy],
    }

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [familyMatch],
      [],
      [confirmedChildSharing],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.extraName).toBe('Infant (0 to 4.99 yrs) Sharing')
    expect(rows[0]?.infantOnly).toBe(true)
  })

  it('converts percent for per-room parents using pax basis', () => {
    const extraction = {
      ...baseExtraction,
      rates: [
        {
          ...mockExtractedRate,
          rateTypeCode: 'PRPN',
          occupancyRules: 'based on 4 pax',
          maxPax: 4,
        },
      ],
      policies: [
        {
          ...childSharingPolicy,
          childBrackets: [
            {
              ageFrom: 12,
              ageTo: 17.99,
              passengerType: 'child' as const,
              adultsSharingWith: 1 as const,
              percentOfAdult: 50,
            },
          ],
        },
      ],
    } satisfies ExtractionResult

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [mockServiceMatch],
      [],
      [confirmedChildSharing],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.pricePercent).toBe(12.5)
  })

  it('falls back to legacy single child-sharing row when childBrackets are absent', () => {
    const extraction = {
      ...baseExtraction,
      policies: [
        {
          type: 'children_sharing' as const,
          verbatimText: 'Children sharing at 50%',
          interpretation: '50% sharing',
          calculationApplied: '50% of PPS',
          peServicesAffected: [],
          confirmed: false,
        },
      ],
    } satisfies ExtractionResult

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [mockServiceMatch],
      [],
      [confirmedChildSharing],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.extraName).toBe('Child (5 to 16.99 yrs) Sharing')
    expect(rows[0]?.pricePercent).toBe(50)
  })

  it('skips child-sharing rows for honeymoon parents', () => {
    const honeymoonMatch: ServiceMatch = {
      ...mockServiceMatch,
      peServiceName: 'FB Honeymoon Villa',
      peServiceCode: 'HM001',
    }
    const extraction = {
      ...baseExtraction,
      policies: [childSharingPolicy],
    }

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [honeymoonMatch],
      [],
      [confirmedChildSharing],
    )

    expect(rows).toHaveLength(0)
  })

  it('does not emit child-sharing rows when policy is unconfirmed', () => {
    const extraction = {
      ...baseExtraction,
      policies: [childSharingPolicy],
    }

    const rows = buildExtrasRows(
      extraction,
      mockSupplier,
      [mockServiceMatch],
      [],
      [mockConfirmedCior],
    )

    expect(rows).toHaveLength(0)
  })

  it('emits seasonal Additional Adult rows for per-room family services', () => {
    const familyParent: ServiceMatch = {
      ...mockServiceMatch,
      peServiceId: 105,
      peServiceName: 'FB Family Tent',
      peServiceCode: 'FT001',
    }
    const extraction = {
      ...baseExtraction,
      rates: [
        {
          ...mockExtractedRate,
          roomType: 'Family Tent',
          mealBasis: 'FB',
          rateTypeCode: 'PRPN',
          rateAmount: 1856,
          validFrom: '2026-01-01',
          validTo: '2026-03-31',
        },
        {
          ...mockExtractedRate,
          roomType: 'Deluxe Double',
          mealBasis: 'FB',
          rateTypeCode: 'PPPN',
          rateAmount: 464,
          validFrom: '2026-01-01',
          validTo: '2026-03-31',
        },
        {
          ...mockExtractedRate,
          roomType: 'Family Tent',
          mealBasis: 'FB',
          rateTypeCode: 'PRPN',
          rateAmount: 1200,
          validFrom: '2026-04-01',
          validTo: '2026-06-30',
        },
        {
          ...mockExtractedRate,
          roomType: 'Deluxe Double',
          mealBasis: 'FB',
          rateTypeCode: 'PPPN',
          rateAmount: 300,
          validFrom: '2026-04-01',
          validTo: '2026-06-30',
        },
      ],
    }

    const rows = buildExtrasRows(extraction, mockSupplier, [familyParent], [], [])

    const additionalAdult = rows.filter((r) => r.extraName === 'Additional Adult')
    expect(additionalAdult).toHaveLength(2)
    expect(additionalAdult.map((r) => r.cost)).toEqual([464, 300])
    expect(additionalAdult.every((r) => r.internalRowType === 'additional_adult')).toBe(true)
  })

  it('emits Additional Child rows from additionalPaxSupplements', () => {
    const familyParent: ServiceMatch = {
      ...mockServiceMatch,
      peServiceId: 105,
      peServiceName: 'FB Family Tent',
      peServiceCode: 'FT001',
    }
    const extraction = {
      ...baseExtraction,
      rates: [
        {
          ...mockExtractedRate,
          roomType: 'Family Tent',
          mealBasis: 'FB',
          rateTypeCode: 'PRPN',
          rateAmount: 1856,
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
        },
      ],
      additionalPaxSupplements: [
        {
          parentRoomType: 'Family Tent',
          mealBasis: 'FB',
          passengerType: 'child' as const,
          ageFrom: 12,
          ageTo: 17.99,
          flatCost: 232,
          validFrom: '2026-01-01',
          validTo: '2026-03-31',
        },
      ],
    } satisfies ExtractionResult

    const rows = buildExtrasRows(extraction, mockSupplier, [familyParent], [], [])

    expect(rows).toHaveLength(1)
    expect(rows[0]?.extraName).toBe('Additional Child (12 to 17.99 yrs)')
    expect(rows[0]?.cost).toBe(232)
    expect(rows[0]?.childOnly).toBe(true)
    expect(rows[0]?.internalRowType).toBe('additional_child')
  })
})
