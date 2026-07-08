import { lookupRateType } from '../../shared/appendixA'
import { DEFAULT_ACCOMMODATION_RATE_TYPE } from '../../shared/constants'
import { resolveBounds } from '../../shared/boundsResolver'
import type {
  ExtractionResult,
  MismatchResolution,
  NonAccommodationRate,
  RateRow,
  Supplier,
  ValidationNote,
} from '../../shared/types'
import { resolveAmount } from '../../shared/mismatchCollector'

const PER_PERSON_CODES = new Set(['PPPN', 'PPPD', 'PPPS', 'PPPU', 'PPPI'])

export function isPerPersonRateType(code: string): boolean {
  return PER_PERSON_CODES.has(code.toUpperCase())
}

export function isPerRoomRateType(code: string): boolean {
  const upper = code.toUpperCase()
  if (isPerPersonRateType(upper)) return false
  return upper.startsWith('PRPN') || upper.startsWith('PHPN') || upper.startsWith('PRPD') || upper === 'PR'
}

function childCostForNonAccom(rate: NonAccommodationRate, adultBuy: number): number {
  if (rate.childCost != null) return rate.childCost
  if (isPerPersonRateType(rate.rateTypeCode)) return adultBuy
  return 0
}

const FEE_KEYWORDS = ['conservancy', 'conservation', 'park fee', 'tax', 'levy', 'contribution']

/** True when a description names a park/conservancy/tax-style fee that belongs on Extras, not Rates. */
export function isFeeShapedDescription(description: string): boolean {
  const lower = description.toLowerCase()
  return FEE_KEYWORDS.some((keyword) => lower.includes(keyword))
}

export interface ServiceMatchLike {
  extractedName: string
  peServiceId: number | null
  peServiceName: string | null
  peServiceCode: string | null
  status: string
}

/** Shared lookup so Rates-sheet matching and Extras-redirect matching never disagree. */
export function findNonAccommodationServiceMatch(
  na: NonAccommodationRate,
  serviceMatches: ServiceMatchLike[],
): ServiceMatchLike | undefined {
  return (
    serviceMatches.find((m) => m.extractedName.toLowerCase() === na.description.toLowerCase()) ??
    serviceMatches.find(
      (m) =>
        m.peServiceName?.toLowerCase().includes(na.description.toLowerCase()) ||
        na.description.toLowerCase().includes(m.extractedName.toLowerCase()),
    )
  )
}

export function buildNonAccommodationRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  serviceMatches: ServiceMatchLike[],
  mismatchResolutions: MismatchResolution[],
  validationNotes: ValidationNote[],
): RateRow[] {
  const rows: RateRow[] = []

  for (const na of extraction.nonAccommodationRates ?? []) {
    if (!na.released) {
      validationNotes.push({
        itemType: 'Non-Accommodation',
        serviceName: na.description,
        issue: `PDF prices '${na.description}' but contract form does not release it`,
        actionRequired: 'Skipped — not released on contract form',
      })
      continue
    }

    const match = findNonAccommodationServiceMatch(na, serviceMatches)

    if (isFeeShapedDescription(na.description)) {
      // Park/conservancy/tax-style fees belong on Extras (see buildFeeRedirectRows), not Rates.
      continue
    }

    if (match?.status !== 'matched' || !match.peServiceCode) {
      // No real bookable PE service for this — treat as an unclassified fee candidate,
      // not a silent drop. buildFeeRedirectRows will pick it up via the same "unmatched" check.
      validationNotes.push({
        itemType: 'Non-Accommodation',
        serviceName: na.description,
        issue: `'${na.description}' did not match any bookable PE service — loaded onto Extras against accommodation parents as a probable fee. Confirm this isn't actually a new non-accommodation service that needs creating in PE.`,
        actionRequired: 'Confirm fee classification, or create the missing PE service if this is a genuine bookable service',
      })
      continue
    }

    const costStr = String(na.cost)
    const resolvedCost = Number(
      resolveAmount(`non-accom:${na.description}:cost`, costStr, costStr, mismatchResolutions),
    )

    const rateType = lookupRateType(na.rateTypeCode)
    const bounds = resolveBounds({
      rateTypeCode: na.rateTypeCode,
      contractConstraints: extraction.contractConstraints,
      validFrom: na.validFrom,
      validTo: na.validTo,
    })

    const adultBuy = na.isDriverGuide ? resolvedCost : resolvedCost
    const adultSell = na.sell
    const childCost = childCostForNonAccom(na, adultBuy)

    rows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      serviceName: match?.peServiceName ?? na.description,
      serviceId: match?.peServiceId ?? 0,
      serviceCode: match?.peServiceCode ?? '',
      dateFrom: na.validFrom,
      dateTo: na.validTo,
      agentGroupId: 0,
      rateCode: na.rateTypeCode,
      rateName: rateType?.name ?? na.rateTypeCode,
      ratePlan: na.rateTypeCode,
      currencyCode: 'USD',
      adultBuy,
      adultSell,
      childCost,
      childSell: childCost,
      markup: 0,
      minPax: bounds.minPax,
      maxPax: bounds.maxPax,
      minStay: bounds.minStay,
      maxStay: bounds.maxStay,
      api: true,
      isException: false,
      businessModel: 'BM1',
      supplierCommission: 0,
      isNonAccommodation: true,
    })
  }

  return rows
}

export function inferAccommodationRateTypeCode(rate: { rateTypeCode?: string; rateCode: string }): string {
  if (rate.rateTypeCode && lookupRateType(rate.rateTypeCode)) return rate.rateTypeCode.toUpperCase()
  if (lookupRateType(rate.rateCode)) return rate.rateCode.toUpperCase()
  return DEFAULT_ACCOMMODATION_RATE_TYPE
}
