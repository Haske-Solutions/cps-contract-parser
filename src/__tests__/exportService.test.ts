import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  buildRows,
  generateExcel,
  buildWorkbookBuffer,
  buildWorkbookFromEditedRows,
  resolveExportRows,
} from '../main/services/exportService'
import {
  buildSession,
  baseExtraction,
  mockServiceMatch,
  mockExtrasMatch,
  mockExtractedRate,
  mockCiorPolicy,
  mockConfirmedCior,
  mockPriorRate,
  mockMismatchResolution,
} from './fixtures'
import type { ExtractedRate, ServiceMatch } from '../shared/types'
import { RATE_CHANGE_THRESHOLD_PCT } from '../shared/constants'

// ─── T1: CIOR rule enforcement ─────────────────────────────────────────────

describe('CIOR rule enforcement', () => {
  it('emits a CIOR rate row with adultBuy = 0 when CIOR policy is confirmed', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, policies: [mockCiorPolicy] },
      confirmedPolicies: [mockConfirmedCior],
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const ciorRow = rateRows.find((r) => r.rateCode === 'CIOR')

    expect(ciorRow).toBeDefined()
    expect(ciorRow?.adultBuy).toBe(0)
    expect(ciorRow?.adultSell).toBe(0)
  })

  it('does not emit CIOR row when policy is not confirmed', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, policies: [mockCiorPolicy] },
      confirmedPolicies: [{ type: 'CIOR', confirmed: false }],
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const ciorRow = rateRows.find((r) => r.rateCode === 'CIOR')

    expect(ciorRow).toBeUndefined()
  })

  it('does not emit CIOR row when no confirmed policies present', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, policies: [mockCiorPolicy] },
      confirmedPolicies: [],
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const ciorRow = rateRows.find((r) => r.rateCode === 'CIOR')

    expect(ciorRow).toBeUndefined()
  })
})

// ─── T2: Child Sell derivation ────────────────────────────────────────────
// Spec: Child Sell always equals Child Cost on every rate row.

describe('Child Sell derivation', () => {
  it('childSell equals childCost on every rate row [spec: invariant I3]', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [mockExtractedRate] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)

    for (const row of rateRows) {
      expect(row.childSell).toBe(row.childCost)
    }
  })
})

// ─── T3: Adult Sell derivation ────────────────────────────────────────────
// Spec: Adult Sell always equals Adult Buy on every non-CIOR rate row.

describe('Adult Sell derivation', () => {
  it('adultSell equals adultBuy on every rate row [spec: invariant I3]', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [mockExtractedRate] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const nonCiorRows = rateRows.filter((r) => r.rateCode !== 'CIOR')

    for (const row of nonCiorRows) {
      expect(row.adultSell).toBe(row.adultBuy)
    }
  })
})

// ─── T4: Rate Code validation ─────────────────────────────────────────────

describe('Rate Code validation', () => {
  it('emits a STOP flag for an unknown rate code', () => {
    const invalidRate: ExtractedRate = {
      ...mockExtractedRate,
      rateCode: 'BOGUS',
    }
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [invalidRate] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows, flags } = buildRows(session)
    const stopFlag = flags.find((f) => f.code === 'INVALID_RATE_CODE')

    expect(stopFlag).toBeDefined()
    expect(stopFlag?.severity).toBe('stop')
    expect(rateRows.filter((r) => r.rateCode === 'BOGUS')).toHaveLength(0)
  })

  it('does not emit a STOP flag for a valid rate code', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })

    const { flags } = buildRows(session)
    const stopFlags = flags.filter((f) => f.code === 'INVALID_RATE_CODE')

    expect(stopFlags).toHaveLength(0)
  })

  it('skips the invalid-code row but still emits valid rows', () => {
    const validRate: ExtractedRate = { ...mockExtractedRate, rateCode: 'SGL' }
    const invalidRate: ExtractedRate = {
      ...mockExtractedRate,
      rateCode: 'NOPE',
      roomType: 'Invalid Room',
    }
    const sglMatch: ServiceMatch = { ...mockServiceMatch, extractedName: 'SGL Room' }
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [validRate, invalidRate] },
      serviceMatches: [mockServiceMatch, sglMatch],
    })

    const { rateRows } = buildRows(session)

    expect(rateRows.some((r) => r.rateCode === 'SGL')).toBe(true)
    expect(rateRows.some((r) => r.rateCode === 'NOPE')).toBe(false)
  })
})

// ─── T5: Extras consolidation ─────────────────────────────────────────────
// Spec: identical rates across seasons → single row.
// Current implementation emits one extras row per extrasMatches entry.
// Two distinct extras services should each produce exactly one row.

describe('Extras consolidation', () => {
  it('emits one extras row per distinct extras match entry', () => {
    const laundryMatch: ServiceMatch = {
      extractedName: 'Laundry',
      peServiceId: 201,
      peServiceName: 'Laundry',
      peServiceCode: 'EX001',
      status: 'matched',
      candidates: [],
    }
    const parkFeeMatch: ServiceMatch = {
      extractedName: 'Park Fee',
      peServiceId: 202,
      peServiceName: 'Park Fee',
      peServiceCode: 'EX002',
      status: 'matched',
      candidates: [],
    }
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      extrasMatches: [laundryMatch, parkFeeMatch],
    })

    const { extrasRows } = buildRows(session)

    expect(extrasRows).toHaveLength(2)
    expect(extrasRows.map((r) => r.serviceCode)).toContain('EX001')
    expect(extrasRows.map((r) => r.serviceCode)).toContain('EX002')
  })

  it('skips extras rows when no parent accommodation service exists (I7)', () => {
    const session = buildSession({
      serviceMatches: [],
      extrasMatches: [mockExtrasMatch, mockExtrasMatch],
    })

    const { extrasRows, flags } = buildRows(session)

    expect(extrasRows).toHaveLength(0)
    expect(flags.filter((f) => f.code === 'EXTRAS_NO_PARENT')).toHaveLength(2)
  })
})

// ─── T6: Mismatch resolutions applied ────────────────────────────────────

describe('Mismatch gate — resolutions override extracted values', () => {
  it('uses the resolved validFrom value from mismatch resolutions', () => {
    const session = buildSession({
      extraction: {
        ...baseExtraction,
        rates: [{ ...mockExtractedRate, validFrom: '2026-01-01' }],
      },
      serviceMatches: [mockServiceMatch],
      mismatchResolutions: [mockMismatchResolution],
    })

    const { rateRows } = buildRows(session)

    expect(rateRows[0]?.validFrom).toBe('2026-02-01')
  })

  it('keeps the extracted validFrom when no resolution exists for that field', () => {
    const session = buildSession({
      extraction: {
        ...baseExtraction,
        rates: [{ ...mockExtractedRate, validFrom: '2026-03-15' }],
      },
      serviceMatches: [mockServiceMatch],
      mismatchResolutions: [],
    })

    const { rateRows } = buildRows(session)

    expect(rateRows[0]?.validFrom).toBe('2026-03-15')
  })
})

// ─── T7: Supplier STOP ────────────────────────────────────────────────────

describe('Supplier STOP', () => {
  it('returns a STOP flag and no rows when supplier is null', () => {
    const session = buildSession({ supplier: null })

    const { rateRows, extrasRows, flags } = buildRows(session)

    expect(rateRows).toHaveLength(0)
    expect(extrasRows).toHaveLength(0)
    expect(flags.some((f) => f.severity === 'stop')).toBe(true)
  })

  it('returns a STOP flag and no rows when extraction is null', () => {
    const session = buildSession({ extraction: null })

    const { rateRows, extrasRows, flags } = buildRows(session)

    expect(rateRows).toHaveLength(0)
    expect(extrasRows).toHaveLength(0)
    expect(flags.some((f) => f.severity === 'stop')).toBe(true)
  })
})

// ─── T8: Min/Max from RATE_CODES ─────────────────────────────────────────

describe('Min/Max values from RATE_CODES', () => {
  it('assigns minPax=2, maxPax=2 to a DBL row', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [{ ...mockExtractedRate, rateCode: 'DBL' }] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const dblRow = rateRows.find((r) => r.rateCode === 'DBL')

    expect(dblRow?.minPax).toBe(2)
    expect(dblRow?.maxPax).toBe(2)
    expect(dblRow?.minStay).toBe(1)
    expect(dblRow?.maxStay).toBe(99)
  })

  it('assigns minPax=1, maxPax=1 to a SGL row', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [{ ...mockExtractedRate, rateCode: 'SGL' }] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const sglRow = rateRows.find((r) => r.rateCode === 'SGL')

    expect(sglRow?.minPax).toBe(1)
    expect(sglRow?.maxPax).toBe(1)
  })

  it('assigns minPax=2, maxPax=6 to a FAM row', () => {
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [{ ...mockExtractedRate, rateCode: 'FAM' }] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const famRow = rateRows.find((r) => r.rateCode === 'FAM')

    expect(famRow?.minPax).toBe(2)
    expect(famRow?.maxPax).toBe(6)
  })
})

// ─── T9: Infant FOC rows ──────────────────────────────────────────────────

describe('Infant FOC rows', () => {
  it('emits an INF rate row explicitly (not omitted) with the extracted amount', () => {
    const infRate: ExtractedRate = {
      ...mockExtractedRate,
      rateCode: 'INF',
      rateAmount: 0,
      childRates: [],
    }
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [infRate] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const infRow = rateRows.find((r) => r.rateCode === 'INF')

    expect(infRow).toBeDefined()
    expect(infRow?.adultBuy).toBe(0)
  })

  it('emits an INF row with childCost = 0 when no child rates are present', () => {
    const infRate: ExtractedRate = {
      ...mockExtractedRate,
      rateCode: 'INF',
      rateAmount: 0,
      childRates: [],
    }
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [infRate] },
      serviceMatches: [mockServiceMatch],
    })

    const { rateRows } = buildRows(session)
    const infRow = rateRows.find((r) => r.rateCode === 'INF')

    expect(infRow?.childCost).toBe(0)
  })
})

// ─── T10: Conservancy supplier identity ──────────────────────────────────

describe('Conservancy supplier identity', () => {
  it('prefixes lodge name to service name when extra contains "conservancy"', () => {
    const conservancyMatch: ServiceMatch = {
      extractedName: 'Mara Conservancy Fee',
      peServiceId: 301,
      peServiceName: 'Mara Conservancy Fee',
      peServiceCode: 'CF001',
      status: 'matched',
      candidates: [],
    }
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      extrasMatches: [conservancyMatch],
    })

    const { extrasRows } = buildRows(session)
    const conservancyRow = extrasRows.find((r) => r.serviceCode === 'CF001')

    expect(conservancyRow).toBeDefined()
    expect(conservancyRow?.service).toContain('Savanna Lodge')
    expect(conservancyRow?.service).toContain('Mara Conservancy Fee')
  })

  it('prefixes lodge name when extra contains "park fee"', () => {
    const parkFeeMatch: ServiceMatch = {
      extractedName: 'National Park Fee',
      peServiceId: 302,
      peServiceName: 'National Park Fee',
      peServiceCode: 'PF001',
      status: 'matched',
      candidates: [],
    }
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      extrasMatches: [parkFeeMatch],
    })

    const { extrasRows } = buildRows(session)
    const parkRow = extrasRows.find((r) => r.serviceCode === 'PF001')

    expect(parkRow?.service).toContain('Savanna Lodge')
    expect(parkRow?.extraCategory).toBe('Park / Conservancy Fee')
  })

  it('does not prefix lodge name for a regular extra (laundry)', () => {
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      extrasMatches: [mockExtrasMatch],
    })

    const { extrasRows } = buildRows(session)

    expect(extrasRows[0]?.service).toBe('Laundry')
  })
})

// ─── T11: Rate row sort order ─────────────────────────────────────────────

describe('Rate row sort order', () => {
  it('sorts rate rows by service name A→Z then validFrom ascending', () => {
    const zRate: ExtractedRate = {
      ...mockExtractedRate,
      roomType: 'Zebra Suite',
      rateCode: 'DBL',
      validFrom: '2026-01-01',
    }
    const aRate: ExtractedRate = {
      ...mockExtractedRate,
      roomType: 'Acacia Room',
      rateCode: 'SGL',
      validFrom: '2026-06-01',
    }
    const aRateEarly: ExtractedRate = {
      ...mockExtractedRate,
      roomType: 'Acacia Room',
      rateCode: 'SGL',
      validFrom: '2026-01-01',
    }
    const zebraMatch: ServiceMatch = { ...mockServiceMatch, extractedName: 'Zebra Suite', peServiceName: 'Zebra Suite' }
    const acaciaMatch: ServiceMatch = { ...mockServiceMatch, extractedName: 'Acacia Room', peServiceName: 'Acacia Room' }
    const session = buildSession({
      extraction: { ...baseExtraction, rates: [zRate, aRate, aRateEarly] },
      serviceMatches: [zebraMatch, acaciaMatch],
    })

    const { rateRows } = buildRows(session)

    expect(rateRows[0]?.service).toBe('Acacia Room')
    expect(rateRows[0]?.validFrom).toBe('2026-01-01')
    expect(rateRows[1]?.service).toBe('Acacia Room')
    expect(rateRows[1]?.validFrom).toBe('2026-06-01')
    expect(rateRows[2]?.service).toBe('Zebra Suite')
  })
})

// ─── T12: Extras row sort order ───────────────────────────────────────────

describe('Extras row sort order', () => {
  it('sorts extras rows by service name A→Z', () => {
    const zebraExtra: ServiceMatch = { ...mockExtrasMatch, extractedName: 'Zebra Park Fee', peServiceName: 'Zebra Park Fee', peServiceCode: 'ZP001', peServiceId: 401 }
    const acaciaExtra: ServiceMatch = { ...mockExtrasMatch, extractedName: 'Acacia Activity', peServiceName: 'Acacia Activity', peServiceCode: 'AA001', peServiceId: 402 }
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      extrasMatches: [zebraExtra, acaciaExtra],
    })

    const { extrasRows } = buildRows(session)

    expect(extrasRows[0]?.service).toBe('Acacia Activity')
    expect(extrasRows[1]?.service).toContain('Zebra Park Fee')
  })
})

// ─── Additional: Prior rate change flags ─────────────────────────────────

describe('Prior rate change flags', () => {
  it(`emits a rate_change flag when change exceeds ${RATE_CHANGE_THRESHOLD_PCT}%`, () => {
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      priorRates: [{ ...mockPriorRate, adultCost: 300 }],
    })

    const { flags } = buildRows(session)
    const changeFlag = flags.find((f) => f.code === 'LARGE_RATE_CHANGE')

    expect(changeFlag).toBeDefined()
    expect(changeFlag?.severity).toBe('rate_change')
  })

  it('does not emit a rate_change flag when change is within threshold', () => {
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      priorRates: [{ ...mockPriorRate, adultCost: 320 }],
    })

    const { flags } = buildRows(session)
    const changeFlag = flags.find((f) => f.code === 'LARGE_RATE_CHANGE')

    expect(changeFlag).toBeUndefined()
  })

  it('emits a rate_change flag for large negative changes', () => {
    const session = buildSession({
      serviceMatches: [mockServiceMatch],
      priorRates: [{ ...mockPriorRate, adultCost: 500 }],
    })

    const { flags } = buildRows(session)
    const changeFlag = flags.find((f) => f.code === 'LARGE_RATE_CHANGE')

    expect(changeFlag).toBeDefined()
  })
})

// ─── Additional: needs_creation service flags ─────────────────────────────

describe('Needs-creation service flags', () => {
  it('emits a needs_creation flag for an unmatched accommodation service', () => {
    const unmatchedService: ServiceMatch = {
      extractedName: 'New Suite Type',
      peServiceId: null,
      peServiceName: null,
      peServiceCode: null,
      status: 'needs_creation',
      candidates: [],
    }
    const session = buildSession({
      serviceMatches: [unmatchedService],
    })

    const { flags } = buildRows(session)
    const ncFlag = flags.find((f) => f.code === 'ACCOMMODATION_SERVICE_MISSING')

    expect(ncFlag).toBeDefined()
    expect(ncFlag?.severity).toBe('needs_creation')
  })
})

// ─── Additional: generateExcel produces a buffer ──────────────────────────

describe('generateExcel', () => {
  it('returns a non-empty ArrayBuffer', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })
    const buffer = generateExcel(session)

    expect(buffer).toBeInstanceOf(ArrayBuffer)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })
})

describe('buildWorkbookBuffer', () => {
  it('serializes edited adultBuy into the Rates sheet', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })
    const { rateRows, extrasRows, flags } = buildRows(session)
    const edited = rateRows.map((row, index) =>
      index === 0 ? { ...row, adultBuy: 9999 } : row,
    )

    const buffer = buildWorkbookBuffer(edited, extrasRows, flags)
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const sheet = workbook.Sheets.Rates
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

    expect(records[0]?.['Adult Buy']).toBe(9999)
  })

  it('buildWorkbookFromEditedRows matches buildWorkbookBuffer', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })
    const built = buildRows(session)
    const a = buildWorkbookBuffer(built.rateRows, built.extrasRows, built.flags)
    const b = buildWorkbookFromEditedRows(built.rateRows, built.extrasRows, built.flags)
    expect(a.byteLength).toBe(b.byteLength)
  })
})

describe('resolveExportRows', () => {
  it('uses outputRows when the session already has edited preview rows', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })
    const { rateRows, extrasRows, flags } = buildRows(session)
    const edited = [{ ...rateRows[0], adultBuy: 4242 }]

    const resolved = resolveExportRows({
      ...session,
      outputRows: edited,
      extrasRows,
      validationFlags: flags,
    })

    expect(resolved.rateRows[0].adultBuy).toBe(4242)
  })

  it('falls back to buildRows when outputRows is empty', () => {
    const session = buildSession({ serviceMatches: [mockServiceMatch] })
    const fromBuild = buildRows(session)
    const resolved = resolveExportRows(session)

    expect(resolved.rateRows.length).toBe(fromBuild.rateRows.length)
    expect(resolved.rateRows[0].adultBuy).toBe(fromBuild.rateRows[0].adultBuy)
  })
})
