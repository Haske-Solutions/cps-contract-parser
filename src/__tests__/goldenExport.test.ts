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
    expect(extrasRows).toEqual([])
    expect(flags.filter((f) => f.severity === 'stop')).toEqual([])
  })
})
