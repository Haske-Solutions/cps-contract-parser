import { describe, it, expect } from 'vitest'
import { APPENDIX_A, lookupRateType, isValidRateTypeCode } from '../shared/appendixA'

describe('appendixA', () => {
  it('contains 279 rate codes', () => {
    expect(APPENDIX_A).toHaveLength(279)
  })

  it('looks up PPPN', () => {
    const ref = lookupRateType('PPPN')
    expect(ref?.name).toBe('Per Person Per Nts')
    expect(ref?.minPax).toBe(1)
  })

  it('rejects unknown codes', () => {
    expect(isValidRateTypeCode('NOTACODE')).toBe(false)
    expect(isValidRateTypeCode('PPPN')).toBe(true)
  })
})
