import { describe, it, expect } from 'vitest'
import { MAX_PROPERTIES_PER_RUN } from '../shared/constants'
import {
  applyGroupSelection,
  capIncludedSelections,
  countIncludedMappings,
  countRemainingReviewable,
  prepareGroupsForNextBatch,
  sortMappingGroupsForDisplay,
  defaultCollapsedMappingGroupIds,
  groupHasContractFormMatch,
} from '../shared/mappingSelection'
import type { PropertyMappingGroup, SupplierMapping } from '../shared/types'

const pe = (id: number, name: string) => ({
  supplier_id: id,
  name,
  code: `C${id}`,
  destination_country: 'KE',
})

function mapping(
  name: string,
  peSupplier: ReturnType<typeof pe> | null,
  included: boolean,
  contractFormMatch = true,
): SupplierMapping {
  return {
    peSupplier,
    detected: peSupplier ? { extractedName: name, properties: [name], confidence: 'high' } : null,
    matchStatus: peSupplier ? 'matched' : 'unmatched_pdf',
    confidence: 'high',
    contractFormMatch,
    included,
    isPrimary: false,
  }
}

function group(id: string, mappings: SupplierMapping[]): PropertyMappingGroup {
  return {
    id,
    parentName: id,
    parentConfidence: 'high',
    mappings,
  }
}

describe('capIncludedSelections', () => {
  it('limits auto-selected properties to MAX_PROPERTIES_PER_RUN', () => {
    const groups = [
      group(
        'collection',
        Array.from({ length: 8 }, (_, i) =>
          mapping(`Property ${i + 1}`, pe(i + 1, `P${i + 1}`), true),
        ),
      ),
    ]

    const capped = capIncludedSelections(groups)
    expect(countIncludedMappings(capped.flatMap((g) => g.mappings))).toBe(MAX_PROPERTIES_PER_RUN)
  })
})

describe('applyGroupSelection', () => {
  it('fills only up to remaining global slots when parent select-all is used', () => {
    const collection = group(
      'collection',
      Array.from({ length: 16 }, (_, i) =>
        mapping(`Camp ${i + 1}`, pe(i + 1, `Camp ${i + 1}`), false),
      ),
    )

    const updated = applyGroupSelection(collection, true, new Set(), 0)
    expect(countIncludedMappings(updated.mappings)).toBe(MAX_PROPERTIES_PER_RUN)
  })

  it('respects already-reviewed properties', () => {
    const collection = group('collection', [
      mapping('Camp 1', pe(1, 'Camp 1'), false),
      mapping('Camp 2', pe(2, 'Camp 2'), false),
    ])

    const updated = applyGroupSelection(collection, true, new Set([1]), 0)
    expect(updated.mappings[0]?.included).toBe(false)
    expect(updated.mappings[1]?.included).toBe(true)
  })

  it('skips properties not on the contract form', () => {
    const collection = group('collection', [
      mapping('Camp 1', pe(1, 'Camp 1'), false, false),
      mapping('Camp 2', pe(2, 'Camp 2'), false, true),
    ])

    const updated = applyGroupSelection(collection, true, new Set(), 0)
    expect(updated.mappings[0]?.included).toBe(false)
    expect(updated.mappings[1]?.included).toBe(true)
  })
})

describe('countRemainingReviewable', () => {
  it('excludes reviewed PE suppliers', () => {
    const groups = [
      group('g', [
        mapping('A', pe(1, 'A'), false),
        mapping('B', pe(2, 'B'), false),
        mapping('C', pe(3, 'C'), false),
      ]),
    ]

    expect(countRemainingReviewable(groups, new Set([1, 2]))).toBe(1)
  })
})

describe('defaultCollapsedMappingGroupIds', () => {
  it('collapses groups with no contract-form match', () => {
    const groups = [
      group('collection', [
        mapping('Tortilis Camp Amboseli', pe(1, 'Tortilis Camp Amboseli'), true, true),
        mapping('Serengeti Migration Camp', pe(4, 'Serengeti Migration Camp'), false, false),
      ]),
      group('solo', [mapping('Loisaba Tented Camp', pe(3, 'Loisaba Tented Camp'), false, false)]),
    ]

    const collapsed = defaultCollapsedMappingGroupIds(groups)

    expect(collapsed.has('collection')).toBe(false)
    expect(collapsed.has('solo')).toBe(true)
    expect(groupHasContractFormMatch(groups[0]!)).toBe(true)
  })
})

describe('sortMappingGroupsForDisplay', () => {
  it('puts contract-form matches first within and across groups', () => {
    const groups = [
      group('other', [
        mapping('Serengeti Migration Camp', pe(4, 'Serengeti Migration Camp'), false, false),
        mapping('Tortilis Camp Amboseli', pe(1, 'Tortilis Camp Amboseli'), true, true),
      ]),
      group('solo', [mapping('Loisaba Tented Camp', pe(3, 'Loisaba Tented Camp'), false, false)]),
    ]

    const sorted = sortMappingGroupsForDisplay(groups)

    expect(sorted[0]?.id).toBe('other')
    expect(sorted[0]?.mappings[0]?.detected?.extractedName).toBe('Tortilis Camp Amboseli')
    expect(sorted[1]?.id).toBe('solo')
  })
})

describe('prepareGroupsForNextBatch', () => {
  it('clears all selections for the next mapping batch', () => {
    const groups = [
      group('g', [mapping('A', pe(1, 'A'), true), mapping('B', pe(2, 'B'), true)]),
    ]

    const next = prepareGroupsForNextBatch(groups)
    expect(countIncludedMappings(next.flatMap((g) => g.mappings))).toBe(0)
  })
})
