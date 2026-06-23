import { describe, it, expect } from 'vitest'
import {
  autoConfirmedPolicies,
  batchMismatchFlags,
  buildExportSession,
} from '../shared/sessionBuilder'
import {
  baseExtraction,
  buildSession,
  extractionWithCrossChecks,
  mockCiorPolicy,
  mockServiceMatch,
  mockSupplier,
} from './fixtures'

describe('sessionBuilder', () => {
  it('builds interactive session with mismatches from extraction', () => {
    const session = buildExportSession({
      id: 'interactive-1',
      supplier: mockSupplier,
      extraction: extractionWithCrossChecks,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      confirmedPolicies: [],
      mode: 'interactive',
    })

    expect(session.mismatches.length).toBeGreaterThan(0)
    expect(session.mismatchResolutions).toEqual([])
    expect(session.confirmedPolicies).toEqual([])
  })

  it('builds batch session with auto-confirmed policies and no mismatches', () => {
    const extraction = { ...baseExtraction, policies: [mockCiorPolicy] }
    const session = buildExportSession({
      id: 'batch-1',
      supplier: mockSupplier,
      extraction,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mode: 'batch',
    })

    expect(session.mismatches).toEqual([])
    expect(session.mismatchResolutions).toEqual([])
    expect(session.confirmedPolicies).toEqual(autoConfirmedPolicies(extraction))
    expect(session.step).toBe(6)
    expect(session.status).toBe('complete')
  })

  it('emits batch mismatch warning flags for unreviewed cross-checks', () => {
    const flags = batchMismatchFlags(extractionWithCrossChecks)
    expect(flags).toHaveLength(1)
    expect(flags[0]?.code).toBe('BATCH_UNREVIEWED_MISMATCHES')
    expect(flags[0]?.severity).toBe('info')
  })

  it('matches buildSession defaults for interactive export shape', () => {
    const fromHelper = buildExportSession({
      id: 'test-session-id',
      createdAt: '2026-01-01T00:00:00.000Z',
      supplier: mockSupplier,
      extraction: baseExtraction,
      serviceMatches: [mockServiceMatch],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mode: 'interactive',
      step: 5,
      status: 'idle',
    })

    const fromFixture = buildSession()
    expect(fromHelper.supplier).toEqual(fromFixture.supplier)
    expect(fromHelper.extraction).toEqual(fromFixture.extraction)
    expect(fromHelper.serviceMatches).toEqual(fromFixture.serviceMatches)
  })
})
