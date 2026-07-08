import { describe, it, expect } from 'vitest'
import { buildNonAccommodationRows } from '../main/services/nonAccommodationBuilder'
import { extractionWithNonAccom, mockSupplier } from './fixtures'

describe('nonAccommodationBuilder', () => {
  it('emits a rate row for released non-accommodation items with a matched PE service', () => {
    const rows = buildNonAccommodationRows(
      extractionWithNonAccom,
      mockSupplier,
      [
        {
          extractedName: 'Airport Transfer',
          peServiceId: 501,
          peServiceName: 'Airport Transfer',
          peServiceCode: 'AT001',
          status: 'matched',
        },
      ],
      [],
      [],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]?.serviceName).toBe('Airport Transfer')
    expect(rows[0]?.isNonAccommodation).toBe(true)
  })

  it('diverts unmatched non-accommodation items to validation notes instead of writing a Service ID 0 row', () => {
    const notes: import('../shared/types').ValidationNote[] = []
    const rows = buildNonAccommodationRows(extractionWithNonAccom, mockSupplier, [], [], notes)

    expect(rows).toHaveLength(0)
    expect(notes.some((n) => n.issue.includes('NEEDS CREATION'))).toBe(true)
  })

  it('redirects fee-shaped descriptions (conservancy/tax/levy/contribution) away from the Rates sheet', () => {
    const extraction = {
      ...extractionWithNonAccom,
      nonAccommodationRates: [
        {
          ...extractionWithNonAccom.nonAccommodationRates![0]!,
          description: 'Mandatory Conservation Contribution',
        },
      ],
    }
    const rows = buildNonAccommodationRows(
      extraction,
      mockSupplier,
      [
        {
          extractedName: 'Mandatory Conservation Contribution',
          peServiceId: 999,
          peServiceName: 'Mandatory Conservation Contribution',
          peServiceCode: 'MCC',
          status: 'matched',
        },
      ],
      [],
      [],
    )

    expect(rows).toHaveLength(0)
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
