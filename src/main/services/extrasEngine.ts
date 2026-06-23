import { lookupRateType } from '../../shared/appendixA'
import {
  DEFAULT_ACCOMMODATION_RATE_TYPE,
  DEFAULT_SUPPLIER_COMMISSION,
  DEFAULT_TAX_CODE,
  DEFAULT_BUSINESS_MODEL,
} from '../../shared/constants'
import type {
  ConfirmedPolicy,
  ExtractionResult,
  ExtractedPolicy,
  ExtrasRow,
  FestiveTerm,
  ServiceMatch,
  Supplier,
} from '../../shared/types'
import { flagsForRowType } from './extrasFlags'
import { consolidateFlatExtras, sortExtrasRows } from './extrasSort'

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

function parkFeeParents(accommodationMatches: ServiceMatch[]): ServiceMatch[] {
  return accommodationMatches.filter((m) => m.peServiceName && isGpkgParent(m.peServiceName))
}

function roomTiedParents(accommodationMatches: ServiceMatch[]): ServiceMatch[] {
  return accommodationMatches.filter(
    (m) => m.peServiceName && (isFbParent(m.peServiceName) || isGpkgParent(m.peServiceName)),
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

function buildChildSharingRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
  confirmedPolicies: ConfirmedPolicy[],
): ExtrasRow[] {
  const policy = extraction.policies.find((p) => p.type === 'children_sharing')
  const confirmed = confirmedPolicies.find((cp) => cp.type === 'children_sharing')
  if (!policy || !confirmed?.confirmed || policy.calculationApplied.includes('ambiguous')) return []

  const pct = parseSharingPercent(policy)
  const rows: ExtrasRow[] = []

  for (const parent of accommodationMatches) {
    if (!parent.peServiceName || !parentAllowsChildExtras(parent.peServiceName)) continue
    if (/\bTRIPLE\b/i.test(parent.peServiceName)) continue

    const baseRate = extraction.rates.find(
      (r) =>
        parent.peServiceName?.toLowerCase().includes(r.roomType.toLowerCase()) ||
        parent.peServiceName?.toLowerCase().includes(r.mealBasis.toLowerCase()),
    )
    const amount =
      pct != null && baseRate ? Math.round(baseRate.rateAmount * (pct / 100) * 100) / 100 : 0

    const isDoubleTwin =
      /\bDOUBLE\b/i.test(parent.peServiceName) || /\bTWIN\b/i.test(parent.peServiceName)
    const extraName = isDoubleTwin
      ? 'Child (5 to 16.99 yrs) Sharing'
      : 'Child (5 to 16.99 yrs) Sharing with 1 Adult'

    rows.push(
      makeExtrasRow(supplier, parent, extraName, {
        internalRowType: 'child_sharing',
        dateFrom: extraction.contractPeriod.from,
        dateTo: extraction.contractPeriod.to,
        cost: amount,
        sell: amount,
        childOnly: true,
        rateCode: 'PPPN',
      }),
    )
  }
  return rows
}

export function buildExtrasRows(
  extraction: ExtractionResult,
  supplier: Supplier,
  accommodationMatches: ServiceMatch[],
  extrasMatches: ServiceMatch[],
  confirmedPolicies: ConfirmedPolicy[],
): ExtrasRow[] {
  if (accommodationMatches.filter((m) => m.status === 'matched').length === 0) return []

  const rows: ExtrasRow[] = [
    ...buildChildSharingRows(extraction, supplier, accommodationMatches, confirmedPolicies),
    ...buildParkFeeRows(extraction, supplier, accommodationMatches),
    ...buildFestiveRows(extraction, supplier, accommodationMatches),
  ]

  for (const extra of extrasMatches) {
    if (extra.status === 'needs_creation') continue
    const parent = accommodationMatches.find((m) => m.status === 'matched') ?? accommodationMatches[0]
    if (!parent) continue

    const isConservancy =
      extra.extractedName.toLowerCase().includes('conservancy') ||
      extra.extractedName.toLowerCase().includes('park fee')

    const property = extraction.properties[0] ?? supplier.name
    const extraName = isConservancy
      ? `${property} — ${extra.extractedName} Adult`
      : `${extra.extractedName} Adult`

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
  }

  void DEFAULT_BUSINESS_MODEL
  void DEFAULT_SUPPLIER_COMMISSION

  return sortExtrasRows(consolidateFlatExtras(rows))
}
