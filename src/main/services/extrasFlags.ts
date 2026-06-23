import type { ExtrasInternalRowType } from '../../shared/types'

export interface ExtrasFlagSet {
  markup: boolean
  discount: boolean
  commission: boolean
  mandatory: boolean
}

export function flagsForRowType(type: ExtrasInternalRowType, contractMandatory?: boolean): ExtrasFlagSet {
  switch (type) {
    case 'child_sharing':
    case 'infant_sharing':
    case 'additional_adult':
    case 'additional_child':
    case 'extra_bed':
      return { markup: true, discount: true, commission: true, mandatory: false }
    case 'festive':
      return { markup: false, discount: false, commission: false, mandatory: true }
    case 'park_fee':
      return {
        markup: false,
        discount: false,
        commission: false,
        mandatory: contractMandatory ?? true,
      }
    default:
      return { markup: false, discount: false, commission: false, mandatory: false }
  }
}
