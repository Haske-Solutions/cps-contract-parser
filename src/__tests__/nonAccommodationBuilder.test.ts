import { describe, it, expect } from 'vitest'
import { buildNonAccommodationRows } from '../main/services/nonAccommodationBuilder'
import { extractionWithNonAccom, mockSupplier } from './fixtures'

describe('nonAccommodationBuilder', () => {
  it('emits a rate row for released non-accommodation items', () => {
    const rows = buildNonAccommodationRows(
      extractionWithNonAccom,
      mockSupplier,
      [],
      [],
      [],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.serviceName).toBe('Airport Transfer')
    expect(rows[0]?.isNonAccommodation).toBe(true)
  })

  it('skips unreleased non-accommodation items', () => {
    const extraction = {
      ...extractionWithNonAccom,
      nonAccommodationRates: [
        {
          ...extractionWithNonAccom.nonAccommodationRates![0]!,
          released: false,
        },
      ],
    }
    const notes: import('../shared/types').ValidationNote[] = []
    const rows = buildNonAccommodationRows(extraction, mockSupplier, [], [], notes)

    expect(rows).toHaveLength(0)
    expect(notes.some((n) => n.actionRequired.includes('Skipped'))).toBe(true)
  })
})
