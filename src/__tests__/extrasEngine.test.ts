import { describe, it, expect } from 'vitest'
import { buildExtrasRows } from '../main/services/extrasEngine'
import { baseExtraction, mockServiceMatch, mockSupplier } from './fixtures'

describe('extrasEngine', () => {
  it('returns empty extras when extraction has no policy or festive data', () => {
    const rows = buildExtrasRows(
      baseExtraction,
      mockSupplier,
      [mockServiceMatch],
      [],
      [],
    )

    expect(rows).toEqual([])
  })
})
