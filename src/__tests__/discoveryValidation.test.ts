import { describe, it, expect } from 'vitest'
import { normalizeDiscoveryResult } from '../main/services/discoveryValidation'

describe('normalizeDiscoveryResult', () => {
  it('normalizes a valid discovery payload', () => {
    const result = normalizeDiscoveryResult(
      {
        anchorTerm: 'Elewana',
        contractPeriod: { from: '2027-01-01', to: '2027-12-31' },
        detectedSuppliers: [
          {
            extractedName: 'Tortilis Camp',
            properties: ['Amboseli'],
            confidence: 'high',
            sectionHint: 'Page 3',
          },
        ],
      },
      'Elewana Fallback',
    )

    expect(result.anchorTerm).toBe('Elewana')
    expect(result.contractPeriod).toEqual({ from: '2027-01-01', to: '2027-12-31' })
    expect(result.detectedSuppliers).toHaveLength(1)
    expect(result.detectedSuppliers[0]?.extractedName).toBe('Tortilis Camp')
    expect(result.detectedSuppliers[0]?.sectionHint).toBe('Page 3')
  })

  it('uses fallback anchor when missing from payload', () => {
    const result = normalizeDiscoveryResult(
      {
        detectedSuppliers: [
          { extractedName: 'Loisaba', properties: [], confidence: 'medium' },
        ],
      },
      'Elewana',
    )

    expect(result.anchorTerm).toBe('Elewana')
  })

  it('parses DD/MM/YYYY contract period dates', () => {
    const result = normalizeDiscoveryResult(
      {
        anchorTerm: 'Elewana',
        contractPeriod: { from: '01/01/2027', to: '31/12/2027' },
        detectedSuppliers: [],
      },
      'Elewana',
    )

    expect(result.contractPeriod).toEqual({ from: '2027-01-01', to: '2027-12-31' })
  })

  it('throws when detectedSuppliers is missing', () => {
    expect(() => normalizeDiscoveryResult({ anchorTerm: 'X' }, 'X')).toThrow(
      /detectedSuppliers/i,
    )
  })
})
