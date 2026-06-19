import { describe, it, expect } from 'vitest'
import {
  buildExtractionUserText,
  filterPeCatalogForExtraction,
} from '../shared/parserInvoke'
import type { Supplier } from '../shared/types'

const peCatalog: Supplier[] = [
  { supplier_id: 1, name: 'Camp A', code: 'CA', destination_country: 'KE' },
  { supplier_id: 2, name: 'Camp B', code: 'CB', destination_country: 'KE' },
  { supplier_id: 3, name: 'Camp C', code: 'CC', destination_country: 'TZ' },
]

describe('filterPeCatalogForExtraction', () => {
  it('returns full catalog when no target is specified', () => {
    expect(filterPeCatalogForExtraction(peCatalog)).toHaveLength(3)
  })

  it('returns only the target supplier for targeted extraction', () => {
    const filtered = filterPeCatalogForExtraction(peCatalog, { targetPeSupplierId: 2 })
    expect(filtered).toEqual([peCatalog[1]])
  })

  it('falls back to full catalog when target id is missing', () => {
    expect(filterPeCatalogForExtraction(peCatalog, { targetPeSupplierId: 99 })).toHaveLength(3)
  })
})

describe('buildExtractionUserText', () => {
  it('includes only the target supplier in the PE catalog context', () => {
    const text = buildExtractionUserText({
      peCatalog,
      targetPeSupplierId: 2,
      targetPropertyLabel: 'Camp B Lodge',
    })

    expect(text).toContain('"id": 2')
    expect(text).not.toContain('"id": 1')
    expect(text).not.toContain('"id": 3')
    expect(text).toContain('Camp B Lodge')
  })
})
