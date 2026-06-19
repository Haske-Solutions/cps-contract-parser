import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../main/services/motherduckClient', () => ({
  runQuery: vi.fn(),
}))

import { runQuery } from '../main/services/motherduckClient'
import {
  accommodationSupplierCatalog,
  accommodationSupplierCatalogForTerms,
} from '../main/services/warehouseService'

const mockRunQuery = vi.mocked(runQuery)

describe('accommodationSupplierCatalog', () => {
  beforeEach(() => {
    mockRunQuery.mockReset()
  })

  it('returns empty array for blank anchor term', async () => {
    expect(await accommodationSupplierCatalog('')).toEqual([])
    expect(mockRunQuery).not.toHaveBeenCalled()
  })

  it('queries accommodation-filtered suppliers by anchor term', async () => {
    const rows = [
      { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
      { supplier_id: 2, name: 'Elsas Kopje', code: 'EK01', destination_country: 'KE' },
    ]
    mockRunQuery.mockResolvedValue(rows)

    const result = await accommodationSupplierCatalog('Elewana')

    expect(result).toEqual(rows)
    expect(mockRunQuery).toHaveBeenCalledOnce()
    const sql = mockRunQuery.mock.calls[0]![0] as string
    expect(sql).toMatch(/type_name IN/)
    expect(sql).toMatch(/Double/)
    expect(sql).toMatch(/House/)
    expect(sql).toMatch(/Elewana/i)
    expect(sql).toMatch(/LIMIT 200/)
    expect(sql).not.toMatch(/LIMIT 20[^0]/)
  })

  it('escapes single quotes in anchor term', async () => {
    mockRunQuery.mockResolvedValue([])
    await accommodationSupplierCatalog("O'Brien")
    const sql = mockRunQuery.mock.calls[0]![0] as string
    expect(sql).toContain("O''Brien")
  })
})

describe('accommodationSupplierCatalogForTerms', () => {
  beforeEach(() => {
    mockRunQuery.mockReset()
  })

  it('unions and dedupes suppliers across anchor terms', async () => {
    mockRunQuery
      .mockResolvedValueOnce([
        { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
      ])
      .mockResolvedValueOnce([
        { supplier_id: 1, name: 'Tortilis Camp', code: 'TC01', destination_country: 'KE' },
        { supplier_id: 2, name: 'Loisaba Tented Camp', code: 'LT01', destination_country: 'KE' },
      ])

    const result = await accommodationSupplierCatalogForTerms(['Elewana Tortilis', 'Elewana'])

    expect(result).toHaveLength(2)
    expect(mockRunQuery).toHaveBeenCalledTimes(2)
  })
})
