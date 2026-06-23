import { describe, it, expect } from 'vitest'
import { collectMismatches } from '../shared/mismatchCollector'
import { baseExtraction } from './fixtures'

describe('mismatchCollector', () => {
  it('collects structured crossChecks', () => {
    const mismatches = collectMismatches({
      ...baseExtraction,
      crossChecks: [
        {
          id: 'cc-1',
          section: 'Accommodation',
          field: 'Cost',
          formValue: '450',
          pdfValue: '500',
        },
      ],
    })
    expect(mismatches).toHaveLength(1)
    expect(mismatches[0]?.formValue).toBe('450')
  })
})
