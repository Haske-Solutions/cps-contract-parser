import { describe, it, expect } from 'vitest'
import { buildRows } from '../main/services/exportService'
import { buildExportSession } from '../shared/sessionBuilder'
import { baseExtraction, mockServiceMatch, mockSupplier } from './fixtures'

describe('golden export', () => {
  it('produces stable accommodation row snapshot for minimal extraction', () => {
    const session = buildExportSession({
      id: 'golden-1',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mode: 'interactive',
    })

    const { rateRows, extrasRows, flags } = buildRows(session)

    expect(rateRows).toMatchSnapshot()
    // Non-CIOR: child cost moves off the Accommodation row and onto an Extras row (Rule 18).
    expect(extrasRows).toHaveLength(1)
    expect(extrasRows[0]?.internalRowType).toBe('child_sharing')
    expect(extrasRows[0]?.cost).toBe(175)
    expect(flags.filter((f) => f.severity === 'stop')).toEqual([])
  })
})
