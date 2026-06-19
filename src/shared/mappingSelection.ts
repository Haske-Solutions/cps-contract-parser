import { MAX_PROPERTIES_PER_RUN } from './constants'
import type { PropertyMappingGroup, SupplierMapping } from './types'
import { flattenMappingGroups } from './supplierMatching'

export function countIncludedMappings(mappings: SupplierMapping[]): number {
  return mappings.filter((m) => m.included && m.peSupplier).length
}

export function isMappingReviewed(
  mapping: SupplierMapping,
  reviewedPeIds: ReadonlySet<number>,
): boolean {
  return mapping.peSupplier != null && reviewedPeIds.has(mapping.peSupplier.supplier_id)
}

export function countRemainingReviewable(
  groups: PropertyMappingGroup[],
  reviewedPeIds: ReadonlySet<number>,
): number {
  return flattenMappingGroups(groups).filter(
    (m) => m.peSupplier && m.contractFormMatch && !isMappingReviewed(m, reviewedPeIds),
  ).length
}

/** Limit auto-selected properties to the per-batch maximum (first eligible in display order). */
export function capIncludedSelections(
  groups: PropertyMappingGroup[],
  max = MAX_PROPERTIES_PER_RUN,
): PropertyMappingGroup[] {
  let slots = max
  return groups.map((group) => ({
    ...group,
    mappings: group.mappings.map((mapping) => {
      if (
        !mapping.peSupplier ||
        !mapping.included ||
        !mapping.contractFormMatch ||
        slots <= 0
      ) {
        return { ...mapping, included: false }
      }
      slots--
      return { ...mapping, included: true }
    }),
  }))
}

/** Reset selections for another batch; reviewed properties stay unselected. */
export function prepareGroupsForNextBatch(
  groups: PropertyMappingGroup[],
): PropertyMappingGroup[] {
  return groups.map((group) => ({
    ...group,
    mappings: group.mappings.map((mapping) => ({ ...mapping, included: false })),
  }))
}

export function applyGroupSelection(
  group: PropertyMappingGroup,
  include: boolean,
  reviewedPeIds: ReadonlySet<number>,
  currentGlobalIncluded: number,
): PropertyMappingGroup {
  if (!include) {
    return {
      ...group,
      mappings: group.mappings.map((m) => ({ ...m, included: false })),
    }
  }

  const remaining = MAX_PROPERTIES_PER_RUN - currentGlobalIncluded
  if (remaining <= 0) return group

  let slots = remaining
  return {
    ...group,
    mappings: group.mappings.map((mapping) => {
      if (
        !mapping.peSupplier ||
        !mapping.contractFormMatch ||
        isMappingReviewed(mapping, reviewedPeIds)
      ) {
        return { ...mapping, included: false }
      }
      if (slots > 0) {
        slots--
        return { ...mapping, included: true }
      }
      return { ...mapping, included: false }
    }),
  }
}

export function selectableInGroup(
  group: PropertyMappingGroup,
  reviewedPeIds: ReadonlySet<number>,
): SupplierMapping[] {
  return group.mappings.filter(
    (m) => m.peSupplier && m.contractFormMatch && !isMappingReviewed(m, reviewedPeIds),
  )
}

/** Contract-form matches first — within groups and across groups. */
export function sortMappingGroupsForDisplay(
  groups: PropertyMappingGroup[],
): PropertyMappingGroup[] {
  return [...groups]
    .map((group) => ({
      ...group,
      mappings: [...group.mappings].sort(
        (a, b) => Number(b.contractFormMatch) - Number(a.contractFormMatch),
      ),
    }))
    .sort((a, b) => {
      const aHasMatch = a.mappings.some((m) => m.contractFormMatch)
      const bHasMatch = b.mappings.some((m) => m.contractFormMatch)
      return Number(bHasMatch) - Number(aHasMatch)
    })
}

export function groupHasContractFormMatch(group: PropertyMappingGroup): boolean {
  return group.mappings.some((m) => m.contractFormMatch)
}

/** Collapse supplier groups that have no property on the uploaded contract form. */
export function defaultCollapsedMappingGroupIds(
  groups: PropertyMappingGroup[],
): Set<string> {
  return new Set(
    groups.filter((group) => !groupHasContractFormMatch(group)).map((group) => group.id),
  )
}
