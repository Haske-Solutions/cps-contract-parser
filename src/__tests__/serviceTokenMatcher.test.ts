import { describe, it, expect } from 'vitest'
import {
  matchRateToServices,
  partialCoverageScore,
  scoreServiceMatch,
  tokenizePeServiceName,
  tokenizeRateRecord,
} from '../shared/serviceTokenMatcher'
import { mockExtractedRate, mockPeServices } from './fixtures'

describe('serviceTokenMatcher', () => {
  it('scores exact FB Double match highly', () => {
    const score = scoreServiceMatch(
      {
        mealBasis: new Set(['FB']),
        roomTypes: new Set(['DOUBLE']),
        policyTiers: new Set(),
        ageBrackets: new Set(),
        markers: new Set(),
        nouns: new Set(['FB', 'DOUBLE', 'SAFARI', 'TENT']),
      },
      'FB Double Safari Tent',
    )
    expect(score).toBeGreaterThan(0)
  })

  it('tokenizes Full Board phrase as FB meal basis', () => {
    const tokens = tokenizePeServiceName('Full Board Double Safari Tent')
    expect(tokens.mealBasis.has('FB')).toBe(true)
    expect(tokens.roomTypes.has('DOUBLE')).toBe(true)
  })

  it('strict-matches Full Board phrase alias on renamed PE service', () => {
    const rate = { ...mockExtractedRate, roomType: 'Safari Tent' }
    const result = matchRateToServices(rate, [mockPeServices[1]!], 'accommodation')
    expect(result.status).toBe('matched')
    expect(result.service?.id).toBe(102)
  })

  it('fuzzy match when PE name drops a room token', () => {
    const rate = {
      ...mockExtractedRate,
      roomType: 'Double Suite Cottage',
      mealBasis: 'FB',
    }
    const result = matchRateToServices(rate, [mockPeServices[3]!], 'accommodation')
    expect(result.status).toBe('fuzzy_match')
    expect(result.service?.id).toBe(104)
  })

  it('partial coverage is below threshold for unrelated services', () => {
    const record = tokenizeRateRecord({ ...mockExtractedRate, mealBasis: 'HB' })
    const score = partialCoverageScore(record, 'FB Double Deluxe')
    expect(score).toBeLessThan(0.75)
  })
})
