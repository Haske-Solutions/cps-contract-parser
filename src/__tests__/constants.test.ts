import { describe, it, expect } from 'vitest'
import {
  RATE_CODES,
  RATE_CODE_SET,
  MIN_PAX_FALLBACK,
  MAX_PAX_FALLBACK,
  MIN_STAY_FALLBACK,
  MAX_STAY_FALLBACK,
  RATE_CHANGE_THRESHOLD_PCT,
} from '../shared/constants'

describe('RATE_CODES — Appendix A completeness', () => {
  const requiredCodes = ['DBL', 'TWN', 'SGL', 'TRP', 'QUD', 'FAM', 'HON', 'CIOR', 'CWA', 'INF', 'CHD', 'SGL1', 'SGL2', 'SGL3']

  it('contains all 14 required rate codes', () => {
    expect(RATE_CODES).toHaveLength(14)
  })

  for (const code of requiredCodes) {
    it(`contains required code "${code}"`, () => {
      expect(RATE_CODE_SET.has(code)).toBe(true)
    })
  }

  it('every RATE_CODES entry is reflected in RATE_CODE_SET', () => {
    for (const def of RATE_CODES) {
      expect(RATE_CODE_SET.has(def.code)).toBe(true)
    }
    expect(RATE_CODE_SET.size).toBe(RATE_CODES.length)
  })

  it('no duplicate rate codes', () => {
    const codes = RATE_CODES.map((r) => r.code)
    const unique = new Set(codes)
    expect(unique.size).toBe(codes.length)
  })
})

describe('RATE_CODES — pax and stay constraints', () => {
  it('CIOR allows exactly 1 pax', () => {
    const cior = RATE_CODES.find((r) => r.code === 'CIOR')!
    expect(cior.minPax).toBe(1)
    expect(cior.maxPax).toBe(1)
  })

  it('DBL requires exactly 2 pax', () => {
    const dbl = RATE_CODES.find((r) => r.code === 'DBL')!
    expect(dbl.minPax).toBe(2)
    expect(dbl.maxPax).toBe(2)
  })

  it('FAM allows 2–6 pax', () => {
    const fam = RATE_CODES.find((r) => r.code === 'FAM')!
    expect(fam.minPax).toBe(2)
    expect(fam.maxPax).toBe(6)
  })

  it('every code has minPax ≤ maxPax', () => {
    for (const def of RATE_CODES) {
      expect(def.minPax).toBeLessThanOrEqual(def.maxPax)
    }
  })

  it('every code has minStay ≤ maxStay', () => {
    for (const def of RATE_CODES) {
      expect(def.minStay).toBeLessThanOrEqual(def.maxStay)
    }
  })
})

describe('Fallback constants', () => {
  it('MIN_PAX_FALLBACK is 1', () => {
    expect(MIN_PAX_FALLBACK).toBe(1)
  })

  it('MAX_PAX_FALLBACK is 99', () => {
    expect(MAX_PAX_FALLBACK).toBe(99)
  })

  it('MIN_STAY_FALLBACK is 1', () => {
    expect(MIN_STAY_FALLBACK).toBe(1)
  })

  it('MAX_STAY_FALLBACK is 99', () => {
    expect(MAX_STAY_FALLBACK).toBe(99)
  })

  it('RATE_CHANGE_THRESHOLD_PCT is 15', () => {
    expect(RATE_CHANGE_THRESHOLD_PCT).toBe(15)
  })
})

describe('RATE_CODE_SET — reject invalid codes', () => {
  const invalidCodes = ['BOGUS', 'XYZ', 'ROOM', 'DBL2', 'TWIN', 'CHILD', '']

  for (const code of invalidCodes) {
    it(`rejects invalid code "${code}"`, () => {
      expect(RATE_CODE_SET.has(code)).toBe(false)
    })
  }
})
