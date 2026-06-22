import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../main/services/motherduckClient', () => ({
  runQueryBound: vi.fn(),
}))

import { runQueryBound } from '../main/services/motherduckClient'
import {
  accommodationSupplierCatalog,
  accommodationSupplierCatalogForTerms,
} from '../main/services/warehouseService'

const mockRunQueryBound = vi.mocked(runQueryBound)

describe('accommodationSupplierCatalog', () => {
  beforeEach(() => {
    mockRunQueryBound.mockReset()
  })

  it('returns empty array for blank anchor term', async () => {
    expect(await accommodationSupplierCatalog('')).toEqual([])
    expect(mockRunQueryBound).not.toHaveBeenCalled()
  })

  it('queries accommodation-filtered suppliers by anchor term', async () => {
    const rows = [
      { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
      { supplier_id: 2, name: 'Elsas Kopje', code: 'EK01', destination_country: 'KE' },
    ]
    mockRunQueryBound.mockResolvedValue(rows)

    const result = await accommodationSupplierCatalog('Elewana')

    expect(result).toEqual(rows)
    expect(mockRunQueryBound).toHaveBeenCalledOnce()
    const [sql, params] = mockRunQueryBound.mock.calls[0]!
    expect(sql).toMatch(/type_name IN/)
    expect(sql).toMatch(/Double/)
    expect(sql).toMatch(/House/)
    expect(sql).toMatch(/ILIKE \$1/)
    expect(sql).toMatch(/LIMIT 200/)
    expect(sql).not.toMatch(/LIMIT 20[^0]/)
    expect(params).toEqual(['%Elewana%'])
  })

  it('passes anchor term as a bound parameter (no SQL injection)', async () => {
    mockRunQueryBound.mockResolvedValue([])
    await accommodationSupplierCatalog("O'Brien")
    const [, params] = mockRunQueryBound.mock.calls[0]!
    expect(params).toEqual(["%O'Brien%"])
  })

  it('normalizes null destination_country from warehouse rows', async () => {
    mockRunQueryBound.mockResolvedValue([
      { supplier_id: 8, name: 'Camp Without Country', code: 'CW', destination_country: null },
    ])

    const result = await accommodationSupplierCatalog('Camp')

    expect(result[0]?.destination_country).toBe('')
  })
})

describe('accommodationSupplierCatalogForTerms', () => {
  beforeEach(() => {
    mockRunQueryBound.mockReset()
  })

  it('unions and dedupes suppliers across anchor terms', async () => {
    mockRunQueryBound
      .mockResolvedValueOnce([
        { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
      ])
      .mockResolvedValueOnce([
        { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
        { supplier_id: 2, name: 'Loisaba Tented Camp', code: 'LT01', destination_country: 'KE' },
      ])

    const result = await accommodationSupplierCatalogForTerms(['Elewana Tortilis', 'Elewana'])

    expect(result).toHaveLength(2)
    expect(mockRunQueryBound).toHaveBeenCalledTimes(2)
  })
})
