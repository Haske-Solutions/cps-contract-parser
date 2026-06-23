import { describe, it, expect } from 'vitest'
import { matchAccommodationRates } from '../shared/serviceMatcher'
import { baseExtraction, mockExtractedRate, mockPeServices } from './fixtures'

describe('serviceMatcher', () => {
  it('matches strict token overlap', () => {
    const matches = matchAccommodationRates(baseExtraction.rates, [mockPeServices[0]!])
    expect(matches[0]?.status).toBe('matched')
    expect(matches[0]?.peServiceId).toBe(101)
  })

  it('strict-matches Full Board phrase alias on renamed PE service', () => {
    const renamedRate = {
      ...mockExtractedRate,
      roomType: 'Safari Tent',
    }
    const matches = matchAccommodationRates([renamedRate], [mockPeServices[1]!])
    expect(matches[0]?.status).toBe('matched')
    expect(matches[0]?.peServiceId).toBe(102)
  })

  it('fuzzy-matches when PE name drops a room token', () => {
    const rate = {
      ...mockExtractedRate,
      roomType: 'Double Suite Cottage',
      mealBasis: 'FB',
    }
    const matches = matchAccommodationRates([rate], [mockPeServices[3]!])
    expect(matches[0]?.status).toBe('multiple_matches')
    expect(matches[0]?.matchConfidence).toBe('fuzzy')
    expect(matches[0]?.candidates[0]?.id).toBe(104)
  })

  it('returns needs_creation when meal basis differs', () => {
    const hbRate = { ...mockExtractedRate, mealBasis: 'HB', roomType: 'Cottage' }
    const matches = matchAccommodationRates([hbRate], [mockPeServices[0]!])
    expect(matches[0]?.status).toBe('needs_creation')
    expect(matches[0]?.candidates).toEqual([])
  })
})
