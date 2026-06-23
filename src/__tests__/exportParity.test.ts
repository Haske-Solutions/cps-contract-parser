import { describe, it, expect } from 'vitest'
import { buildRows } from '../main/services/exportService'
import { buildExportSession } from '../shared/sessionBuilder'
import { matchAccommodationRates } from '../shared/serviceMatcher'
import {
  baseExtraction,
  mockPeServices,
  mockServiceMatch,
  mockSupplier,
} from './fixtures'

describe('export parity', () => {
  it('interactive and batch modes produce identical rate rows on clean extraction', () => {
    const serviceMatches = matchAccommodationRates(baseExtraction.rates, mockPeServices)

    const interactive = buildExportSession({
      id: 'interactive',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches,
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      confirmedPolicies: [],
      mode: 'interactive',
    })

    const batch = buildExportSession({
      id: 'batch',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches,
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mode: 'batch',
    })

    const interactiveRows = buildRows(interactive).rateRows
    const batchRows = buildRows(batch).rateRows

    expect(batchRows).toEqual(interactiveRows)
  })

  it('batch mode does not apply mismatch resolutions', () => {
    const interactive = buildExportSession({
      id: 'interactive',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mismatchResolutions: [
        {
          id: 'm1',
          field: 'amount',
          chosenValue: '999',
          resolution: 'other',
          otherNote: 'manual',
        },
      ],
      mode: 'interactive',
    })

    const batch = buildExportSession({
      id: 'batch',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mode: 'batch',
    })

    expect(interactive.mismatchResolutions).toHaveLength(1)
    expect(batch.mismatchResolutions).toHaveLength(0)
  })
})
