import { describe, it, expect } from 'vitest'
import { calculateCiorChildCost } from '../main/services/ciorCalculator'
import { mockCiorPolicy, mockExtractedRate } from './fixtures'

describe('ciorCalculator', () => {
  it('calculates 75% of PPS', () => {
    const cost = calculateCiorChildCost(mockCiorPolicy, mockExtractedRate)
    expect(cost).toBe(262.5)
  })
})
