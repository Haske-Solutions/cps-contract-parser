import { lookupRateType } from '../../shared/appendixA'
import {
  DEFAULT_ACCOMMODATION_RATE_TYPE,
  DEFAULT_SUPPLIER_COMMISSION,
  DEFAULT_TAX_CODE,
  DEFAULT_BUSINESS_MODEL,
} from '../../shared/constants'
import type {
  ConfirmedPolicy,
  AdditionalPaxSupplement,
  ChildSharingBracket,
  ExtractionResult,
  ExtractedPolicy,
  ExtractedRate,
  ExtrasRow,
  FestiveTerm,
  NonAccommodationRate,
  ServiceMatch,
  Supplier,
} from '../../shared/types'
import { scoreServiceRefAgainstRate } from '../../shared/serviceTokenMatcher'
import { findMatchForRate } from '../../shared/serviceMatcher'
import { flagsForRowType } from './extrasFlags'
import { consolidateFlatExtras, sortExtrasRows } from './extrasSort'
import {
  findNonAccommodationServiceMatch,
  inferAccommodationRateTypeCode,
  isFeeShapedDescription,
  isPerPersonRateType,
  isPerRoomRateType,
  type ServiceMatchLike,
} from './nonAccommodationBuilder'

function isGpkgParent(name: string): boolean {
  return /\bGPKG\b/i.test(name) || /\bGAME\s*PACKAGE\b/i.test(name)
}

function isFbParent(name: string): boolean {
  return /\bFB\b/i.test(name) || /\bFULL\s*BOARD\b/i.test(name)
}

function isHoneymoonParent(name: string): boolean {
  return /\bHONEYMOON\b/i.test(name) || /\bHON\b/i.test(name)
}

function isCiorParent(name: string): boolean {
  return /\bCIOR\b/i.test(name)
}

/** True when the matched PE service is a true Child-In-Own-Room service (Rule 18). */
export function isCiorService(name: string | null | undefined): boolean {
  return !!name && isCiorParent(name)
}

function isGuidePilotParent(name: string): boolean {
  return /\bGUIDE\b/i.test(name) || /\bPILOT\b/i.test(name)
}

function parentAllowsChildExtras(parentName: string): boolean {
  if (isHoneymoonParent(parentName)) return false
  if (isGuidePilotParent(parentName)) return false
  return true
}

function parentAllowsAdultParkFee(parentName: string): boolean {
  return !isCiorParent(parentName)
}

function parentAllowsChildParkFee(parentName: string): boolean {
  if (!parentAllowsChildExtras(parentName)) return false
  if (isCiorParent(parentName)) return true
  if (/\bSINGLE\b/i.test(parentName) && !/\bFAMILY\b/i.test(parentName)) return false
  return true
}

/** True when this supplier's services distinguish FB vs GPKG at all (Rule 19 assumes it always does). */
function hasFbOrGpkgDistinction(accommodationMatches: ServiceMatch[]): boolean {
  return accommodationMatches.some(
    (m) => m.peServiceName && (isFbParent(m.peServiceName) || isGpkgParent(m.peServiceName)),
  )
}

function parkFeeParents(accommodationMatches: ServiceMatch[]): ServiceMatch[] {
  if (!hasFbOrGpkgDistinction(accommodationMatches)) return accommodationMatches
  return accommodationMatches.filter((m) => m.peServiceName && isGpkgParent(m.peServiceName))
}

function roomTiedParents(accommodationMatches: ServiceMatch[]): ServiceMatch[] {
  if (!hasFbOrGpkgDistinction(accommodationMatches)) return accommodationMatches
  return accommodationMatches.filter(
    (m) => m.peServiceName && (isFbParent(m.peServiceName) || isGpkgParent(m.peServiceName)),
  )
}

function findNonAccommodationRatesForExtra(
  extraction: ExtractionResult,
  extra: ServiceMatch,
): NonAccommodationRate[] {
  const rates = (extraction.nonAccommodationRates ?? []).filter((na) => na.released)
  const extracted = extra.extractedName.toLowerCase()

  const exact = rates.filter((na) => na.description.toLowerCase() === extracted)
  if (exact.length > 0) return exact

  return rates.filter(
    (na) =>
      extra.peServiceName?.toLowerCase().includes(na.description.toLowerCase()) ||
      na.description.toLowerCase().includes(extracted) ||
      extracted.includes(na.description.toLowerCase()),
  )
}

function makeExtrasRow(
  supplier: Supplier,
  parent: ServiceMatch,
  extraName: string,
  opts: Partial<ExtrasRow> & { internalRowType: ExtrasRow['internalRowType'] },
): ExtrasRow {
  const flags = flagsForRowType(opts.internalRowType, opts.mandatory)
  const rateCode = opts.rateCode ?? DEFAULT_ACCOMMODATION_RATE_TYPE
  const rateType = lookupRateType(rateCode)
  return {
    supplierName: supplier.name,
    supplierCode: supplier.code,
    supplierId: supplier.supplier_id,
    parentServiceName: parent.peServiceName ?? '',
    parentServiceCode: parent.peServiceCode ?? '',
    parentServiceId: parent.peServiceId ?? 0,
    extraType: '',
    extraName,
    dateFrom: opts.dateFrom ?? '',
    dateTo: opts.dateTo ?? '',
    agentGroupId: 0,
    rateCode,
    rateName: rateType?.name ?? rateCode,
    currency: 'USD',
    cost: opts.cost ?? null,
    sell: opts.sell ?? null,
    pricePercent: opts.pricePercent ?? null,
    taxCode: DEFAULT_TAX_CODE,
    childOnly: opts.childOnly ?? false,
    infantOnly: opts.infantOnly ?? false,
    markup: flags.markup,
    discount: flags.discount,
    mandatory: opts.mandatory ?? flags.mandatory,
    noReport: false,
    commission: flags.commission,
    capacityChange: false,
    percentFromChildPrice: opts.percentFromChildPrice ?? false,
    noVoucher: false,
    internalRowType: opts.internalRowType,
  }
}

function buildParkFeeRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
): ExtrasRow[] {
  const rows: ExtrasRow[] = []
  const parents = parkFeeParents(accommodationMatches)
  if (parents.length === 0) return rows

  for (const fee of extraction.parkFees ?? []) {
    for (const parent of parents) {
      if (parentAllowsAdultParkFee(parent.peServiceName ?? '')) {
        rows.push(
          makeExtrasRow(supplier, parent, `${fee.name} Adult`, {
            internalRowType: 'park_fee',
            dateFrom: fee.validFrom,
            dateTo: fee.validTo,
            cost: fee.adultAmount,
            sell: fee.adultAmount,
            childOnly: false,
            mandatory: true,
          }),
        )
      }
      if (parentAllowsChildParkFee(parent.peServiceName ?? '')) {
        for (const bracket of fee.childBrackets) {
          rows.push(
            makeExtrasRow(
              supplier,
              parent,
              `${fee.name} Child (${bracket.ageFrom} to ${bracket.ageTo} yrs)`,
              {
                internalRowType: 'park_fee',
                dateFrom: fee.validFrom,
                dateTo: fee.validTo,
                cost: bracket.amount,
                sell: bracket.amount,
                childOnly: true,
                mandatory: true,
              },
            ),
          )
        }
      }
    }
  }
  return rows
}

function festiveLabel(type: FestiveTerm['type']): string {
  switch (type) {
    case 'christmas':
      return 'Christmas Supplement'
    case 'new_year':
      return 'New Year Supplement'
    case 'gala':
      return 'Gala Night Dinner'
    default:
      return 'Festive Supplement'
  }
}

function buildFestiveRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
): ExtrasRow[] {
  const rows: ExtrasRow[] = []
  const parents = roomTiedParents(accommodationMatches)

  for (const term of extraction.festiveTerms ?? []) {
    if (term.needsClarification) continue
    const label = festiveLabel(term.type)
    for (const parent of parents) {
      rows.push(
        makeExtrasRow(supplier, parent, `${label} Adult`, {
          internalRowType: 'festive',
          dateFrom: term.validFrom,
          dateTo: term.validTo,
          cost: term.adultAmount,
          sell: term.adultAmount,
          mandatory: true,
        }),
      )
      const childAmount = term.childAmount ?? term.adultAmount
      if (term.childBrackets?.length) {
        for (const b of term.childBrackets) {
          rows.push(
            makeExtrasRow(
              supplier,
              parent,
              `${label} Child (${b.ageFrom} to ${b.ageTo} yrs)`,
              {
                internalRowType: 'festive',
                dateFrom: term.validFrom,
                dateTo: term.validTo,
                cost: b.amount,
                sell: b.amount,
                childOnly: true,
                mandatory: true,
              },
            ),
          )
        }
      } else {
        rows.push(
          makeExtrasRow(supplier, parent, `${label} Child`, {
            internalRowType: 'festive',
            dateFrom: term.validFrom,
            dateTo: term.validTo,
            cost: childAmount,
            sell: childAmount,
            childOnly: true,
            mandatory: true,
          }),
        )
      }
    }
  }
  return rows
}

function parseSharingPercent(policy: ExtractedPolicy): number | null {
  const m = policy.calculationApplied.match(/(\d+(?:\.\d+)?)\s*%/)
  return m ? Number(m[1]) : null
}

function formatAgeBracket(ageFrom: number, ageTo: number): string {
  const fmt = (value: number) => (Number.isInteger(value) ? String(value) : String(value))
  return `${fmt(ageFrom)} to ${fmt(ageTo)} yrs`
}

function isDoubleTwinParent(name: string): boolean {
  return /\bDOUBLE\b/i.test(name) || /\bTWIN\b/i.test(name)
}

function isFamilyParent(name: string): boolean {
  return /\bFAMILY\b/i.test(name) || /\bPRIVATE\s*HOUSE\b/i.test(name)
}

function isSingleParent(name: string): boolean {
  return /\bSINGLE\b/i.test(name) && !/\bFAMILY\b/i.test(name)
}

function isCiorAccommodationParent(name: string): boolean {
  return /\bCIOR\b/i.test(name)
}

function buildChildSharingExtraName(bracket: ChildSharingBracket, parentName: string): string {
  const ageLabel = formatAgeBracket(bracket.ageFrom, bracket.ageTo)
  if (bracket.passengerType === 'infant') {
    return `Infant (${ageLabel}) Sharing`
  }

  if (isDoubleTwinParent(parentName)) {
    if (bracket.adultsSharingWith === 1) {
      return `Child (${ageLabel}) Sharing with 1 Adult`
    }
    if (bracket.adultsSharingWith === 2) {
      return `Child (${ageLabel}) Sharing with 2 Adults`
    }
    return `Child (${ageLabel}) Sharing`
  }

  return `Child (${ageLabel}) Sharing with 1 Adult`
}

function parentAcceptsChildSharingBracket(parentName: string, bracket: ChildSharingBracket): boolean {
  if (!parentAllowsChildExtras(parentName)) return false
  if (/\bTRIPLE\b/i.test(parentName)) return false
  if (isSingleParent(parentName)) return false
  if (isCiorAccommodationParent(parentName)) return false

  if (bracket.passengerType === 'infant') {
    return isDoubleTwinParent(parentName) || isFamilyParent(parentName)
  }

  return isDoubleTwinParent(parentName)
}

function findBaseRateForParent(extraction: ExtractionResult, parent: ServiceMatch): ExtractedRate | undefined {
  return extraction.rates.find(
    (rate) =>
      parent.peServiceName?.toLowerCase().includes(rate.roomType.toLowerCase()) ||
      parent.peServiceName?.toLowerCase().includes(rate.mealBasis.toLowerCase()),
  )
}

function parentPaxBasis(rate: ExtractedRate): number {
  const basedOn = rate.occupancyRules.match(/based\s+on\s+(\d+)/i)
  if (basedOn) return Number(basedOn[1])
  if (rate.maxPax != null && rate.maxPax > 1) return rate.maxPax
  return 1
}

function convertPercentForParent(percent: number, rateTypeCode: string, baseRate?: ExtractedRate): number {
  if (isPerPersonRateType(rateTypeCode)) return percent
  const basis = baseRate ? parentPaxBasis(baseRate) : 1
  return Math.round((percent / basis) * 10000) / 10000
}

function legacyChildSharingBrackets(policy: ExtractedPolicy): ChildSharingBracket[] {
  const pct = parseSharingPercent(policy)
  if (pct == null) {
    return [
      {
        ageFrom: 5,
        ageTo: 16.99,
        passengerType: 'child',
        adultsSharingWith: null,
        flatCost: 0,
      },
    ]
  }

  return [
    {
      ageFrom: 5,
      ageTo: 16.99,
      passengerType: 'child',
      adultsSharingWith: null,
      percentOfAdult: pct,
    },
  ]
}

function childSharingBracketsForPolicy(policy: ExtractedPolicy): ChildSharingBracket[] {
  if (policy.childBrackets?.length) return policy.childBrackets
  return legacyChildSharingBrackets(policy)
}

function buildChildSharingRowOpts(
  bracket: ChildSharingBracket,
  extraction: ExtractionResult,
  parent: ServiceMatch,
): Partial<ExtrasRow> & { internalRowType: ExtrasRow['internalRowType'] } {
  const baseRate = findBaseRateForParent(extraction, parent)
  const rateTypeCode = baseRate ? inferAccommodationRateTypeCode(baseRate) : 'PPPN'
  const internalRowType = bracket.passengerType === 'infant' ? 'infant_sharing' : 'child_sharing'

  if (bracket.percentOfAdult != null) {
    const pricePercent = convertPercentForParent(bracket.percentOfAdult, rateTypeCode, baseRate)
    return {
      internalRowType,
      dateFrom: extraction.contractPeriod.from,
      dateTo: extraction.contractPeriod.to,
      cost: null,
      sell: null,
      pricePercent,
      childOnly: bracket.passengerType === 'child',
      infantOnly: bracket.passengerType === 'infant',
      rateCode: 'PPPN',
    }
  }

  const flatCost = bracket.flatCost ?? 0
  return {
    internalRowType,
    dateFrom: extraction.contractPeriod.from,
    dateTo: extraction.contractPeriod.to,
    cost: flatCost,
    sell: flatCost,
    pricePercent: null,
    childOnly: bracket.passengerType === 'child',
    infantOnly: bracket.passengerType === 'infant',
    rateCode: 'PPPN',
  }
}

function buildChildSharingRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
  confirmedPolicies: ConfirmedPolicy[],
): ExtrasRow[] {
  const policy = extraction.policies.find((p) => p.type === 'children_sharing')
  const confirmed = confirmedPolicies.find((cp) => cp.type === 'children_sharing')
  if (!policy || !confirmed?.confirmed || policy.calculationApplied.includes('ambiguous')) return []

  const brackets = childSharingBracketsForPolicy(policy)
  const rows: ExtrasRow[] = []

  for (const parent of accommodationMatches) {
    if (!parent.peServiceName) continue

    for (const bracket of brackets) {
      if (!parentAcceptsChildSharingBracket(parent.peServiceName, bracket)) continue

      rows.push(
        makeExtrasRow(
          supplier,
          parent,
          buildChildSharingExtraName(bracket, parent.peServiceName),
          buildChildSharingRowOpts(bracket, extraction, parent),
        ),
      )
    }
  }
  return rows
}

/** Converts non-CIOR rate.childRates[] brackets into child-sharing Extras rows (Rule 18). */
function buildRateChildRateRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
): ExtrasRow[] {
  const rows: ExtrasRow[] = []

  for (const rate of extraction.rates) {
    if (rate.isNonAccommodation) continue
    if (rate.childRates.length === 0) continue

    const match = findMatchForRate(rate, accommodationMatches)
    if (!match || match.status !== 'matched' || !match.peServiceName) continue
    if (isCiorService(match.peServiceName)) continue
    if (!parentAllowsChildExtras(match.peServiceName)) continue

    const rateTypeCode = inferAccommodationRateTypeCode(rate)

    for (const child of rate.childRates) {
      rows.push(
        makeExtrasRow(supplier, match, `Child (${formatAgeBracket(child.ageFrom, child.ageTo)}) Sharing`, {
          internalRowType: 'child_sharing',
          dateFrom: rate.validFrom,
          dateTo: rate.validTo,
          cost: child.amount,
          sell: child.amount,
          childOnly: true,
          rateCode: rateTypeCode,
        }),
      )
    }
  }

  return rows
}

const ADDITIONAL_PAX_MATCH_THRESHOLD = 0.5

function isFamilyOrPrivateHouseRoom(roomType: string): boolean {
  return /\bFAMILY\b/i.test(roomType) || /\bPRIVATE\s*HOUSE\b/i.test(roomType)
}

function supplementServiceReference(supplement: AdditionalPaxSupplement): string {
  return [supplement.mealBasis, supplement.parentRoomType].filter(Boolean).join(' ').trim()
}

function supplementToRate(supplement: AdditionalPaxSupplement): ExtractedRate {
  return {
    propertyName: supplement.propertyName ?? '',
    roomType: supplement.parentRoomType,
    mealBasis: supplement.mealBasis ?? '',
    seasonName: '',
    validFrom: supplement.validFrom,
    validTo: supplement.validTo,
    rateAmount: 0,
    currency: 'USD',
    rateCode: 'FAM',
    occupancyRules: '',
    childRates: [],
    singleSupplement: null,
    notes: '',
  }
}

function parentMatchesAdditionalPaxSupplement(
  parent: ServiceMatch,
  supplement: AdditionalPaxSupplement,
): boolean {
  if (!parent.peServiceName || !isFamilyParent(parent.peServiceName)) return false
  const ref = supplementServiceReference(supplement)
  if (!ref) return true
  return scoreServiceRefAgainstRate(ref, supplementToRate(supplement)) >= ADDITIONAL_PAX_MATCH_THRESHOLD
}

function findPerRoomRateForParent(
  extraction: ExtractionResult,
  parent: ServiceMatch,
  supplement: AdditionalPaxSupplement,
): ExtractedRate | undefined {
  const parentRef = parent.peServiceName ?? supplementServiceReference(supplement)
  return extraction.rates.find((rate) => {
    if (rate.isNonAccommodation) return false
    if (rate.validFrom !== supplement.validFrom || rate.validTo !== supplement.validTo) return false
    if (!isPerRoomRateType(inferAccommodationRateTypeCode(rate))) return false
    return scoreServiceRefAgainstRate(parentRef, rate) >= ADDITIONAL_PAX_MATCH_THRESHOLD
  })
}

function findPpsReferenceRate(
  rates: ExtractedRate[],
  perRoomRate: ExtractedRate,
): ExtractedRate | undefined {
  return rates.find(
    (rate) =>
      !rate.isNonAccommodation &&
      isPerPersonRateType(inferAccommodationRateTypeCode(rate)) &&
      rate.mealBasis.toLowerCase() === perRoomRate.mealBasis.toLowerCase() &&
      rate.validFrom === perRoomRate.validFrom &&
      rate.validTo === perRoomRate.validTo &&
      (rate.propertyName === perRoomRate.propertyName || !perRoomRate.propertyName),
  )
}

function deriveAdditionalPaxSupplements(extraction: ExtractionResult): AdditionalPaxSupplement[] {
  if (extraction.additionalPaxSupplements?.length) return extraction.additionalPaxSupplements

  const supplements: AdditionalPaxSupplement[] = []
  for (const rate of extraction.rates) {
    if (rate.isNonAccommodation) continue
    if (!isPerRoomRateType(inferAccommodationRateTypeCode(rate))) continue
    if (!isFamilyOrPrivateHouseRoom(rate.roomType)) continue

    const pps = findPpsReferenceRate(extraction.rates, rate)
    if (!pps) continue

    supplements.push({
      parentRoomType: rate.roomType,
      mealBasis: rate.mealBasis,
      propertyName: rate.propertyName,
      passengerType: 'adult',
      flatCost: pps.rateAmount,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
    })
  }
  return supplements
}

function buildAdditionalPaxExtraName(supplement: AdditionalPaxSupplement): string {
  if (supplement.passengerType === 'adult') return 'Additional Adult'
  const ageLabel = formatAgeBracket(supplement.ageFrom ?? 0, supplement.ageTo ?? 0)
  if (supplement.passengerType === 'infant') return `Additional Infant (${ageLabel})`
  return `Additional Child (${ageLabel})`
}

function buildAdditionalPaxRowOpts(
  supplement: AdditionalPaxSupplement,
  extraction: ExtractionResult,
  parent: ServiceMatch,
): Partial<ExtrasRow> & { internalRowType: ExtrasRow['internalRowType'] } {
  const perRoomRate = findPerRoomRateForParent(extraction, parent, supplement)
  const rateTypeCode = perRoomRate ? inferAccommodationRateTypeCode(perRoomRate) : 'PRPN'
  const internalRowType =
    supplement.passengerType === 'child' ? 'additional_child' : 'additional_adult'

  if (supplement.percentOfAdult != null) {
    return {
      internalRowType,
      dateFrom: supplement.validFrom,
      dateTo: supplement.validTo,
      cost: null,
      sell: null,
      pricePercent: convertPercentForParent(supplement.percentOfAdult, rateTypeCode, perRoomRate),
      childOnly: supplement.passengerType === 'child',
      infantOnly: supplement.passengerType === 'infant',
      rateCode: 'PPPN',
    }
  }

  const flatCost = supplement.flatCost ?? 0
  return {
    internalRowType,
    dateFrom: supplement.validFrom,
    dateTo: supplement.validTo,
    cost: flatCost,
    sell: flatCost,
    pricePercent: null,
    childOnly: supplement.passengerType === 'child',
    infantOnly: supplement.passengerType === 'infant',
    rateCode: 'PPPN',
  }
}

function buildAdditionalPaxRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
): ExtrasRow[] {
  const supplements = deriveAdditionalPaxSupplements(extraction)
  const rows: ExtrasRow[] = []

  for (const supplement of supplements) {
    if (!supplement.parentRoomType) continue

    for (const parent of accommodationMatches) {
      if (!parentMatchesAdditionalPaxSupplement(parent, supplement)) continue

      rows.push(
        makeExtrasRow(
          supplier,
          parent,
          buildAdditionalPaxExtraName(supplement),
          buildAdditionalPaxRowOpts(supplement, extraction, parent),
        ),
      )
    }
  }

  return rows
}

/** True when an extrasMatches entry already accounts for this non-accommodation fee item. */
function isHandledByExtrasMatch(na: NonAccommodationRate, extrasMatches: ServiceMatch[]): boolean {
  const description = na.description.toLowerCase()
  return extrasMatches.some(
    (extra) =>
      extra.status !== 'needs_creation' &&
      (extra.extractedName.toLowerCase() === description ||
        extra.peServiceName?.toLowerCase().includes(description) ||
        description.includes(extra.extractedName.toLowerCase())),
  )
}

/**
 * Non-accommodation entries belong on Extras, not the Rates sheet, when either the description
 * is keyword-obvious (conservancy/tax/levy/contribution) or — the stronger signal — the entry
 * never matched a real bookable PE service at all (no PE service is ever named "Kwanini
 * Foundation & Community Fee"). Per-vehicle/per-item entries that fail to match are left out of
 * this redirect (NEEDS CREATION only) since those are far more likely to be genuine missing
 * services than fees; only per-person unmatched entries are auto-redirected as probable fees.
 */
function buildFeeRedirectRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
  extrasMatches: ServiceMatch[],
  nonAccomServiceMatches: ServiceMatchLike[],
): ExtrasRow[] {
  const rows: ExtrasRow[] = []
  const parents = parkFeeParents(accommodationMatches)
  if (parents.length === 0) return rows

  for (const na of extraction.nonAccommodationRates ?? []) {
    if (!na.released) continue
    if (isHandledByExtrasMatch(na, extrasMatches)) continue

    const looksLikeFee = isFeeShapedDescription(na.description)
    if (!looksLikeFee) {
      const hasRealServiceMatch =
        findNonAccommodationServiceMatch(na, nonAccomServiceMatches)?.status === 'matched'
      if (hasRealServiceMatch) continue
      if (!isPerPersonRateType(na.rateTypeCode)) continue
    }

    for (const parent of parents) {
      rows.push(
        makeExtrasRow(supplier, parent, `${na.description} Adult`, {
          internalRowType: 'park_fee',
          dateFrom: na.validFrom,
          dateTo: na.validTo,
          cost: na.cost,
          sell: na.sell,
          rateCode: na.rateTypeCode,
          mandatory: true,
        }),
      )
    }
  }

  return rows
}

export function buildExtrasRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
  extrasMatches: ServiceMatch[],
  confirmedPolicies: ConfirmedPolicy[],
  nonAccomServiceMatches: ServiceMatchLike[] = [],
): ExtrasRow[] {
  if (accommodationMatches.filter((m) => m.status === 'matched').length === 0) return []

  const rows: ExtrasRow[] = [
    ...buildChildSharingRows(extraction, supplier, accommodationMatches, confirmedPolicies),
    ...buildRateChildRateRows(extraction, supplier, accommodationMatches),
    ...buildAdditionalPaxRows(extraction, supplier, accommodationMatches),
    ...buildParkFeeRows(extraction, supplier, accommodationMatches),
    ...buildFestiveRows(extraction, supplier, accommodationMatches),
    ...buildFeeRedirectRows(extraction, supplier, accommodationMatches, extrasMatches, nonAccomServiceMatches),
  ]

  for (const extra of extrasMatches) {
    if (extra.status === 'needs_creation') continue
    const parent = accommodationMatches.find((m) => m.status === 'matched') ?? accommodationMatches[0]
    if (!parent) continue

    const isConservancy = isFeeShapedDescription(extra.extractedName)

    const property = extraction.properties[0] ?? supplier.name
    const extraName = isConservancy
      ? `${property} — ${extra.extractedName} Adult`
      : `${extra.extractedName} Adult`

    const naRates = findNonAccommodationRatesForExtra(extraction, extra)

    if (naRates.length === 0) {
      rows.push(
        makeExtrasRow(supplier, parent, extraName, {
          internalRowType: isConservancy ? 'park_fee' : 'other',
          dateFrom: extraction.contractPeriod.from,
          dateTo: extraction.contractPeriod.to,
          cost: 0,
          sell: 0,
          mandatory: isConservancy,
        }),
      )
      continue
    }

    for (const na of naRates) {
      rows.push(
        makeExtrasRow(supplier, parent, extraName, {
          internalRowType: isConservancy ? 'park_fee' : 'other',
          dateFrom: na.validFrom,
          dateTo: na.validTo,
          cost: na.cost,
          sell: na.sell,
          rateCode: na.rateTypeCode,
          mandatory: isConservancy,
        }),
      )
    }
  }

  void DEFAULT_BUSINESS_MODEL
  void DEFAULT_SUPPLIER_COMMISSION

  return sortExtrasRows(consolidateFlatExtras(rows))
}
