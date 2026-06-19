import { describe, it, expect } from 'vitest'
import { maskSecret } from '../shared/tokenDisplay'

describe('maskSecret', () => {
  it('masks middle of a long token while showing head and tail', () => {
    const masked = maskSecret('md_duckdb_abcd1234efgh5678')
    expect(masked.startsWith('md_d')).toBe(true)
    expect(masked.endsWith('5678')).toBe(true)
    expect(masked).toContain('•')
    expect(masked).not.toBe('md_duckdb_abcd1234efgh5678')
  })

  it('fully masks very short values', () => {
    expect(maskSecret('short')).toBe('••••••••')
  })
})
