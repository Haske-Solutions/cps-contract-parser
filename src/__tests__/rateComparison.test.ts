import { describe, expect, it } from 'vitest'
import {
  computePercentChange,
  computeRateChangeServiceIds,
  dedupePriorRates,
  enrichPriorRatesWithNew,
  isHighRateChange,
} from '../shared/rateComparison'
import {
  baseExtraction,
  mockExtractedRate,
  mockPriorRate,
  mockServiceMatch,
} from './fixtures'

describe('dedupePriorRates', () => {
  it('keeps the most recent row per service name', () => {
    const deduped = dedupePriorRates([
      { ...mockPriorRate, adultCost: 700, logTimestamp: '2024-01-01T00:00:00Z' },
      { ...mockPriorRate, adultCost: 772, logTimestamp: '2025-06-01T00:00:00Z' },
      {
        ...mockPriorRate,
        serviceName: 'FB Picnic Lunch Box',
        adultCost: 28,
        logTimestamp: '2025-01-01T00:00:00Z',
      },
    ])

    expect(deduped).toHaveLength(2)
    expect(deduped.find((r) => r.serviceName === 'Deluxe Double')?.adultCost).toBe(772)
  })
})

describe('computePercentChange', () => {
  it('returns null when prior cost is zero', () => {
    expect(computePercentChange(0, 100)).toBeNull()
  })

  it('computes positive and negative changes', () => {
    expect(computePercentChange(300, 350)).toBeCloseTo(16.67, 1)
    expect(computePercentChange(400, 350)).toBeCloseTo(-12.5, 1)
  })
})

describe('enrichPriorRatesWithNew', () => {
  it('matches prior service names to extracted room types', () => {
    const enriched = enrichPriorRatesWithNew(
      [{ ...mockPriorRate, serviceName: 'Deluxe Double', adultCost: 300 }],
      baseExtraction,
      [mockServiceMatch],
    )

    expect(enriched[0].newRate).toBe(350)
    expect(enriched[0].percentChange).toBeCloseTo(16.67, 1)
  })

  it('matches PE service names from warehouse history to extracted room types', () => {
    const extraction = {
      ...baseExtraction,
      rates: [
        {
          ...mockExtractedRate,
          propertyName: 'Elewana Serengeti Migration Camp',
          roomType: 'GPKG Double Safari Tent',
          rateAmount: 820,
        },
      ],
    }

    const enriched = enrichPriorRatesWithNew(
      [{ ...mockPriorRate, serviceName: 'GPKG Double Safari Tent', adultCost: 772 }],
      extraction,
      [
        {
          ...mockServiceMatch,
          extractedName: 'GPKG Double Safari Tent',
          peServiceName: 'GPKG Double Safari Tent',
        },
      ],
    )

    expect(enriched[0].newRate).toBe(820)
    expect(enriched[0].percentChange).toBeCloseTo(6.22, 1)
  })
})

describe('isHighRateChange', () => {
  it('flags changes above the threshold', () => {
    expect(isHighRateChange({ percentChange: 16 })).toBe(true)
    expect(isHighRateChange({ percentChange: 10 })).toBe(false)
    expect(isHighRateChange({ percentChange: -20 })).toBe(true)
  })
})

describe('computeRateChangeServiceIds', () => {
  it('returns service IDs for large changes', () => {
    const ids = computeRateChangeServiceIds(
      [{ ...mockPriorRate, percentChange: 20, newRate: 360 }],
      [mockServiceMatch],
    )

    expect(ids.has(101)).toBe(true)
  })
})
