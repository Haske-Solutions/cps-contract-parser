import { describe, it, expect } from 'vitest'
import { detectMismatches } from '../renderer/lib/mismatchDetection'
import type { ExtractionResult } from '@shared/types'

const baseExtraction: ExtractionResult = {
  supplierName: 'Test Lodge',
  contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
  properties: ['Main Camp'],
  rates: [],
  policies: [],
}

describe('detectMismatches', () => {
  it('returns empty array when no conflict notes exist', () => {
    const extraction: ExtractionResult = {
      ...baseExtraction,
      rates: [
        {
          propertyName: 'Main Camp',
          roomType: 'Double',
          mealBasis: 'FB',
          seasonName: 'High',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
          rateAmount: 500,
          currency: 'USD',
          rateCode: 'BAR',
          occupancyRules: '',
          childRates: [],
          singleSupplement: null,
          notes: 'No issues',
        },
      ],
    }
    expect(detectMismatches(extraction)).toEqual([])
  })

  it('detects form vs PDF conflicts in rate notes', () => {
    const extraction: ExtractionResult = {
      ...baseExtraction,
      rates: [
        {
          propertyName: 'Main Camp',
          roomType: 'Double',
          mealBasis: 'FB',
          seasonName: 'High',
          validFrom: '2026-01-01',
          validTo: '2026-12-31',
          rateAmount: 500,
          currency: 'USD',
          rateCode: 'BAR',
          occupancyRules: '',
          childRates: [],
          singleSupplement: null,
          notes: 'Conflict: Form: $450 vs PDF: $500',
        },
      ],
    }
    const mismatches = detectMismatches(extraction)
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0].formValue).toContain('450')
    expect(mismatches[0].pdfValue).toContain('500')
  })
})
