import { describe, it, expect } from 'vitest'
import {
  resolveExtractionBatch,
  isExtractionSuggestedForSupplier,
} from '../shared/extractionUtils'
import {
  shouldFastPathMapping,
  buildFastPathMappings,
} from '../shared/supplierMatching'
import { baseExtraction, mockSupplier } from './fixtures'

describe('resolveExtractionBatch', () => {
  it('auto-selects when only one supplier is extracted', () => {
    const result = resolveExtractionBatch({ suppliers: [baseExtraction] })

    expect(result.mode).toBe('selected')
    if (result.mode === 'selected') {
      expect(result.extraction.supplierName).toBe('Savanna Lodge')
    }
  })

  it('requires user selection when multiple suppliers are extracted', () => {
    const other = { ...baseExtraction, supplierName: 'River Camp' }
    const result = resolveExtractionBatch({ suppliers: [baseExtraction, other] })

    expect(result.mode).toBe('pick')
    if (result.mode === 'pick') {
      expect(result.batch.suppliers).toHaveLength(2)
    }
  })

  it('throws when no suppliers are extracted', () => {
    expect(() => resolveExtractionBatch({ suppliers: [] })).toThrow(/No supplier contracts/i)
  })
})

describe('mapping fast path', () => {
  it('skips gate when one PE catalog entry and one detection', () => {
    const pe = [mockSupplier]
    const detected = [{ extractedName: 'Savanna Lodge', properties: [], confidence: 'high' as const }]
    expect(shouldFastPathMapping(pe, detected)).toBe(true)
    const mappings = buildFastPathMappings(pe, detected)
    expect(mappings[0]?.included).toBe(true)
    expect(mappings[0]?.isPrimary).toBe(true)
  })
})

describe('isExtractionSuggestedForSupplier', () => {
  it('returns true when names match', () => {
    expect(isExtractionSuggestedForSupplier(baseExtraction, mockSupplier)).toBe(true)
  })

  it('returns false when names do not match', () => {
    expect(
      isExtractionSuggestedForSupplier(
        { ...baseExtraction, supplierName: 'Other Lodge' },
        mockSupplier,
      ),
    ).toBe(false)
  })
})
