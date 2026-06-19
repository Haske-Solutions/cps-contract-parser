import { describe, it, expect } from 'vitest'
import {
  matchDetectedToCatalog,
  shouldFastPathMapping,
  buildFastPathMappings,
  finalizeMappings,
  expandDetectedSuppliers,
  normalizeDetectedSuppliers,
  consolidateDetectedSuppliers,
  splitPropertyLabel,
  buildMappingGroups,
  flattenMappingGroups,
  includedMappingsInOrder,
  semanticMatchScore,
  rankPeCatalogForDetection,
  matchesContractFormProperty,
} from '../shared/supplierMatching'
import type { DetectedSupplier, Supplier } from '../shared/types'

const peCatalog: Supplier[] = [
  { supplier_id: 1, name: 'Tortilis Camp Amboseli', code: 'TC01', destination_country: 'KE' },
  { supplier_id: 2, name: 'Elsas Kopje Meru', code: 'EK01', destination_country: 'KE' },
  { supplier_id: 3, name: 'Loisaba Tented Camp', code: 'LT01', destination_country: 'KE' },
  { supplier_id: 4, name: 'Serengeti Migration Camp', code: 'SMC01', destination_country: 'TZ' },
  { supplier_id: 5, name: 'Tarangire Treetops', code: 'TT01', destination_country: 'TZ' },
]

describe('semanticMatchScore', () => {
  it('matches property names without shared brand prefix', () => {
    const result = semanticMatchScore('Serengeti Migration Camp', 'Serengeti Migration Camp')
    expect(result.score).toBeGreaterThanOrEqual(0.9)
    expect(result.confidence).toBe('high')
  })

  it('matches PDF property to PE name via distinctive tokens', () => {
    const result = semanticMatchScore('Tarangire Treetops', 'Tarangire Treetops')
    expect(result.confidence).toBe('high')
  })

  it('does not force match on brand-only overlap', () => {
    const result = semanticMatchScore('Elewana Collection', 'Serengeti Migration Camp')
    expect(result.score).toBeLessThan(0.34)
  })
})

describe('splitPropertyLabel', () => {
  it('splits comma-separated property bundles', () => {
    expect(
      splitPropertyLabel('Serengeti Migration Camp, Arusha Coffee Lodge, Tortilis Camp'),
    ).toEqual(['Serengeti Migration Camp', 'Arusha Coffee Lodge', 'Tortilis Camp'])
  })
})

describe('matchesContractFormProperty', () => {
  it('matches contract form filename property to PDF property label', () => {
    expect(
      matchesContractFormProperty('Elewana Tortilis Camp Amboseli', ['Tortilis Camp Amboseli']),
    ).toBe(true)
  })

  it('rejects unrelated properties', () => {
    expect(
      matchesContractFormProperty('Elewana Tortilis Camp Amboseli', ['Serengeti Migration Camp']),
    ).toBe(false)
  })
})

describe('buildMappingGroups', () => {
  it('creates one checkbox row per property under a parent group', () => {
    const detected: DetectedSupplier[] = [
      {
        extractedName: 'Elewana Collection',
        properties: ['Serengeti Migration Camp', 'Tarangire Treetops'],
        confidence: 'medium',
      },
    ]

    const { groups, unmatchedPe } = buildMappingGroups(detected, peCatalog)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.parentName).toBe('Elewana Collection')
    expect(groups[0]?.mappings).toHaveLength(2)
    expect(groups[0]?.mappings.map((m) => m.detected?.extractedName)).toEqual([
      'Serengeti Migration Camp',
      'Tarangire Treetops',
    ])
    expect(unmatchedPe.length).toBeGreaterThan(0)
  })

  it('flattens groups back into property-level mappings', () => {
    const { groups } = buildMappingGroups(
      [
        {
          extractedName: 'Elewana Collection',
          properties: ['Serengeti Migration Camp'],
          confidence: 'high',
        },
      ],
      peCatalog,
    )

    expect(flattenMappingGroups(groups)).toHaveLength(1)
  })

  it('folds duplicate singleton detections into an existing collection group', () => {
    const detected: DetectedSupplier[] = [
      {
        extractedName: 'Elewana Collection',
        properties: [
          'Serengeti Migration Camp',
          'Tortilis Camp Amboseli',
          'Tarangire Treetops',
        ],
        confidence: 'high',
      },
      {
        extractedName: 'Elewana Tortilis Camp Amboseli',
        properties: ['Elewana Tortilis Camp Amboseli'],
        confidence: 'high',
      },
    ]

    const { groups } = buildMappingGroups(detected, peCatalog)

    expect(groups).toHaveLength(1)
    expect(groups[0]?.parentName).toBe('Elewana Collection')
    expect(groups[0]?.mappings.map((m) => m.detected?.extractedName)).toEqual(
      expect.arrayContaining([
        'Serengeti Migration Camp',
        'Tortilis Camp Amboseli',
        'Tarangire Treetops',
      ]),
    )
  })

  it('auto-includes only the property matching the contract form', () => {
    const detected: DetectedSupplier[] = [
      {
        extractedName: 'Elewana Collection',
        properties: ['Serengeti Migration Camp', 'Tortilis Camp Amboseli', 'Tarangire Treetops'],
        confidence: 'high',
      },
    ]

    const { groups } = buildMappingGroups(
      detected,
      peCatalog,
      'Elewana Tortilis Camp Amboseli',
    )

    const mappings = groups[0]?.mappings ?? []
    const tortilis = mappings.find((m) => m.detected?.extractedName === 'Tortilis Camp Amboseli')
    const serengeti = mappings.find((m) => m.detected?.extractedName === 'Serengeti Migration Camp')

    expect(tortilis?.contractFormMatch).toBe(true)
    expect(tortilis?.included).toBe(true)
    expect(serengeti?.contractFormMatch).toBe(false)
    expect(serengeti?.included).toBe(false)
  })
})

describe('consolidateDetectedSuppliers', () => {
  it('removes singleton rows that duplicate a collection property', () => {
    const consolidated = consolidateDetectedSuppliers([
      {
        extractedName: 'Elewana Collection',
        properties: ['Tortilis Camp Amboseli', 'Serengeti Migration Camp'],
        confidence: 'high',
      },
      {
        extractedName: 'Elewana Tortilis Camp Amboseli',
        properties: [],
        confidence: 'high',
      },
    ])

    expect(consolidated).toHaveLength(1)
    expect(consolidated[0]?.extractedName).toBe('Elewana Collection')
  })
})

describe('normalizeDetectedSuppliers', () => {
  it('expands bundled comma-separated property strings', () => {
    const normalized = normalizeDetectedSuppliers([
      {
        extractedName: 'Elewana Collection',
        properties: ['Serengeti Migration Camp, Tarangire Treetops'],
        confidence: 'medium',
      },
    ])

    expect(normalized[0]?.properties).toEqual([
      'Serengeti Migration Camp',
      'Tarangire Treetops',
    ])
  })
})

describe('expandDetectedSuppliers', () => {
  it('splits group detections into one entry per property', () => {
    const grouped: DetectedSupplier[] = [
      {
        extractedName: 'Elewana Collection',
        properties: ['Serengeti Migration Camp', 'Tarangire Treetops', 'Loisaba Tented Camp'],
        confidence: 'medium',
      },
    ]

    const expanded = expandDetectedSuppliers(grouped)
    expect(expanded).toHaveLength(3)
    expect(expanded.map((d) => d.extractedName)).toEqual([
      'Serengeti Migration Camp',
      'Tarangire Treetops',
      'Loisaba Tented Camp',
    ])
  })
})

describe('matchDetectedToCatalog', () => {
  it('matches detected suppliers to PE catalog by name similarity', () => {
    const detected: DetectedSupplier[] = [
      {
        extractedName: 'Tortilis Camp',
        properties: ['Tortilis Camp Amboseli'],
        confidence: 'high',
      },
      {
        extractedName: 'Elsas Kopje',
        properties: ['Meru National Park'],
        confidence: 'medium',
      },
    ]

    const mappings = matchDetectedToCatalog(detected, peCatalog)
    const matched = mappings.filter((m) => m.matchStatus === 'matched')

    expect(matched).toHaveLength(2)
    expect(matched[0]?.peSupplier?.supplier_id).toBe(1)
    expect(matched[1]?.peSupplier?.supplier_id).toBe(2)
  })

  it('semantically matches grouped PDF properties to PE without brand prefix', () => {
    const detected: DetectedSupplier[] = [
      {
        extractedName: 'Elewana Collection',
        properties: ['Serengeti Migration Camp', 'Tarangire Treetops'],
        confidence: 'medium',
      },
    ]

    const mappings = matchDetectedToCatalog(detected, peCatalog)
    const matched = mappings.filter((m) => m.matchStatus === 'matched')

    expect(matched).toHaveLength(2)
    expect(matched.map((m) => m.peSupplier?.name)).toEqual(
      expect.arrayContaining(['Serengeti Migration Camp', 'Tarangire Treetops']),
    )
  })

  it('includes unmatched PE catalog entries as informational rows', () => {
    const detected: DetectedSupplier[] = [
      { extractedName: 'Tortilis Camp', properties: [], confidence: 'high' },
    ]

    const mappings = matchDetectedToCatalog(detected, peCatalog)
    const unmatchedPe = mappings.filter((m) => m.matchStatus === 'unmatched_pe')

    expect(unmatchedPe.length).toBeGreaterThan(0)
    expect(unmatchedPe.every((m) => !m.included)).toBe(true)
  })

  it('marks unmatched PDF detections separately', () => {
    const detected: DetectedSupplier[] = [
      { extractedName: 'Unknown Safari Lodge', properties: [], confidence: 'low' },
    ]

    const mappings = matchDetectedToCatalog(detected, peCatalog)
    const unmatchedPdf = mappings.find((m) => m.matchStatus === 'unmatched_pdf')

    expect(unmatchedPdf).toBeDefined()
    expect(unmatchedPdf?.peSupplier).toBeNull()
    expect(unmatchedPdf?.included).toBe(false)
  })
})

describe('rankPeCatalogForDetection', () => {
  it('ranks the best semantic PE match first in the dropdown list', () => {
    const detected: DetectedSupplier = {
      extractedName: 'Serengeti Migration Camp',
      properties: ['Serengeti Migration Camp'],
      confidence: 'high',
    }

    const ranked = rankPeCatalogForDetection(detected, peCatalog)
    expect(ranked[0]?.name).toBe('Serengeti Migration Camp')
  })
})

describe('shouldFastPathMapping', () => {
  it('returns true when exactly one PE and one detection', () => {
    expect(
      shouldFastPathMapping(
        [peCatalog[0]!],
        [{ extractedName: 'Tortilis', properties: [], confidence: 'high' }],
      ),
    ).toBe(true)
  })

  it('returns false for multiple detections', () => {
    expect(
      shouldFastPathMapping(peCatalog, [
        { extractedName: 'A', properties: [], confidence: 'high' },
        { extractedName: 'B', properties: [], confidence: 'high' },
      ]),
    ).toBe(false)
  })
})

describe('buildFastPathMappings', () => {
  it('builds a single included primary mapping', () => {
    const detected = [{ extractedName: 'Tortilis', properties: [], confidence: 'high' as const }]
    const mappings = buildFastPathMappings([peCatalog[0]!], detected)

    expect(mappings).toHaveLength(1)
    expect(mappings[0]?.included).toBe(true)
    expect(mappings[0]?.isPrimary).toBe(true)
  })
})

describe('finalizeMappings', () => {
  it('returns mappings unchanged', () => {
    const mappings = [
      {
        peSupplier: peCatalog[0]!,
        detected: null,
        matchStatus: 'matched' as const,
        confidence: 'high' as const,
        contractFormMatch: true,
        included: true,
        isPrimary: false,
      },
      {
        peSupplier: peCatalog[1]!,
        detected: null,
        matchStatus: 'matched' as const,
        confidence: 'high' as const,
        contractFormMatch: true,
        included: true,
        isPrimary: false,
      },
    ]

    expect(finalizeMappings(mappings)).toEqual(mappings)
  })
})

describe('includedMappingsInOrder', () => {
  it('keeps only included mappings in source order', () => {
    const mappings = [
      {
        peSupplier: peCatalog[0]!,
        detected: null,
        matchStatus: 'matched' as const,
        confidence: 'high' as const,
        contractFormMatch: true,
        included: false,
        isPrimary: false,
      },
      {
        peSupplier: peCatalog[1]!,
        detected: null,
        matchStatus: 'matched' as const,
        confidence: 'high' as const,
        contractFormMatch: true,
        included: true,
        isPrimary: false,
      },
      {
        peSupplier: peCatalog[2]!,
        detected: null,
        matchStatus: 'matched' as const,
        confidence: 'high' as const,
        contractFormMatch: true,
        included: true,
        isPrimary: false,
      },
    ]

    const included = includedMappingsInOrder(mappings)
    expect(included).toHaveLength(2)
    expect(included.map((m) => m.peSupplier?.supplier_id)).toEqual([2, 3])
  })
})
