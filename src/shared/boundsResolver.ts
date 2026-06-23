import { lookupRateType } from './appendixA'
import {
  MAX_PAX_FALLBACK,
  MAX_STAY_FALLBACK,
  MIN_PAX_FALLBACK,
  MIN_STAY_FALLBACK,
} from './constants'
import type { ContractConstraint } from './types'

export interface BoundsInput {
  rateTypeCode: string
  contractConstraints?: ContractConstraint[]
  validFrom?: string
  validTo?: string
  rateConstraints?: {
    minStay?: number
    maxStay?: number
    minPax?: number
    maxPax?: number
  }
}

export interface ResolvedBounds {
  minPax: number
  maxPax: number
  minStay: number
  maxStay: number
  overrideLogged?: string
  usedFallback?: boolean
}

function constraintApplies(
  c: ContractConstraint,
  validFrom?: string,
  validTo?: string,
): boolean {
  if (!c.dateBandFrom && !c.dateBandTo) return true
  if (!validFrom || !validTo) return true
  const bandFrom = c.dateBandFrom ?? '0000-01-01'
  const bandTo = c.dateBandTo ?? '9999-12-31'
  return validFrom <= bandTo && validTo >= bandFrom
}

export function resolveBounds(input: BoundsInput): ResolvedBounds {
  const { rateTypeCode, contractConstraints = [], validFrom, validTo, rateConstraints } = input

  let minPax: number | undefined = rateConstraints?.minPax
  let maxPax: number | undefined = rateConstraints?.maxPax
  let minStay: number | undefined = rateConstraints?.minStay
  let maxStay: number | undefined = rateConstraints?.maxStay
  let overrideLogged: string | undefined

  for (const c of contractConstraints) {
    if (!constraintApplies(c, validFrom, validTo)) continue
    if (c.minPax != null) minPax = c.minPax
    if (c.maxPax != null) maxPax = c.maxPax
    if (c.minStay != null) {
      minStay = c.minStay
      overrideLogged = `Contract min stay ${c.minStay} applied${c.scope ? ` (${c.scope})` : ''}`
    }
    if (c.maxStay != null) maxStay = c.maxStay
  }

  const appendix = lookupRateType(rateTypeCode)
  if (minPax == null) minPax = appendix?.minPax ?? MIN_PAX_FALLBACK
  if (maxPax == null) maxPax = appendix?.maxPax ?? MAX_PAX_FALLBACK
  if (minStay == null) minStay = appendix?.minStay ?? MIN_STAY_FALLBACK
  if (maxStay == null) maxStay = appendix?.maxStay ?? MAX_STAY_FALLBACK

  const usedFallback = !appendix && !rateConstraints

  return {
    minPax,
    maxPax,
    minStay,
    maxStay,
    overrideLogged,
    usedFallback,
  }
}
