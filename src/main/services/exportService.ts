import * as XLSX from 'xlsx'
import type {
  ParseSession,
  RateRow,
  ExtrasRow,
  ValidationFlag,
  ServiceMatch,
  MismatchResolution,
} from '../../shared/types'
import {
  RATE_CODES,
  RATE_CODE_SET,
  RATES_COLUMNS,
  EXTRAS_COLUMNS,
  MIN_PAX_FALLBACK,
  MAX_PAX_FALLBACK,
  MIN_STAY_FALLBACK,
  MAX_STAY_FALLBACK,
} from '../../shared/constants'
import { enrichPriorRatesWithNew, isHighRateChange } from '../../shared/rateComparison'
import { getExtractionValidationFlags } from './extractionValidation'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findServiceMatch(
  name: string,
  matches: ServiceMatch[],
): ServiceMatch | undefined {
  const needle = name.toLowerCase()
  return (
    matches.find((m) => m.extractedName.toLowerCase() === needle) ??
    matches.find(
      (m) =>
        m.extractedName.toLowerCase().includes(needle) ||
        needle.includes(m.extractedName.toLowerCase()),
    )
  )
}

function applyResolution(
  field: string,
  defaultValue: string,
  resolutions: MismatchResolution[],
): string {
  const r = resolutions.find((res) => res.field === field)
  return r ? r.chosenValue : defaultValue
}

function rateRowToRecord(row: RateRow): Record<string, unknown> {
  return {
    'Supplier Name': row.supplierName,
    'Supplier ID': row.supplierId,
    'Supplier Code': row.supplierCode,
    Service: row.service,
    'Service ID': row.serviceId,
    'Service Code': row.serviceCode,
    'Valid From': row.validFrom,
    'Valid To': row.validTo,
    'Agent Group ID': row.agentGroupId,
    'Rate Code': row.rateCode,
    'Rate Name': row.rateName,
    'Rate Plan': row.ratePlan,
    'Currency Buy': row.currencyBuy,
    'Currency Sell': row.currencySell,
    'Adult Buy': row.adultBuy,
    'Adult Sell': row.adultSell,
    'Child Cost': row.childCost,
    'Child Sell': row.childSell,
    Markup: row.markup,
    'Min Pax': row.minPax,
    'Max Pax': row.maxPax,
    'Min Stay': row.minStay,
    'Max Stay': row.maxStay,
    API: row.api,
    'Is Active': row.isActive,
    'Is Exception': row.isException,
  }
}

function extrasRowToRecord(row: ExtrasRow): Record<string, unknown> {
  return {
    'Supplier Name': row.supplierName,
    'Supplier ID': row.supplierId,
    'Supplier Code': row.supplierCode,
    Service: row.service,
    'Service ID': row.serviceId,
    'Service Code': row.serviceCode,
    'Valid From': row.validFrom,
    'Valid To': row.validTo,
    'Agent Group ID': row.agentGroupId,
    'Rate Code': row.rateCode,
    'Rate Name': row.rateName,
    'Currency Buy': row.currencyBuy,
    'Currency Sell': row.currencySell,
    'Adult Buy': row.adultBuy,
    'Adult Sell': row.adultSell,
    'Child Cost': row.childCost,
    'Child Sell': row.childSell,
    Markup: row.markup,
    'Min Pax': row.minPax,
    'Max Pax': row.maxPax,
    'Min Stay': row.minStay,
    'Max Stay': row.maxStay,
    API: row.api,
    'Is Active': row.isActive,
    'Is Exception': row.isException,
    'Extra Category': row.extraCategory,
    'Price Type': row.priceType,
    'Business Model': 'cost',
  }
}

// ─── Core export logic ────────────────────────────────────────────────────────

export function buildRows(session: ParseSession): {
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
} {
  const rateRows: RateRow[] = []
  const extrasRows: ExtrasRow[] = []
  const flags: ValidationFlag[] = []

  if (!session.extraction || !session.supplier) {
    flags.push({
      severity: 'stop',
      code: 'MISSING_EXTRACTION',
      message: 'No extraction result or supplier — cannot generate rows.',
    })
    return { rateRows, extrasRows, flags }
  }

  const { extraction, supplier, serviceMatches, extrasMatches, mismatchResolutions, confirmedPolicies, priorRates: prior } = session

  flags.push(...getExtractionValidationFlags(extraction))

  const accommodationServiceIds = new Set(
    serviceMatches.map((m) => m.peServiceId).filter((id): id is number => id !== null),
  )

  // ── Build rate rows from extracted rates ──────────────────────────────────

  for (const rate of extraction.rates) {
    // I1: validate rate code
    if (!RATE_CODE_SET.has(rate.rateCode)) {
      flags.push({
        severity: 'stop',
        code: 'INVALID_RATE_CODE',
        message: `Rate code "${rate.rateCode}" is not in Appendix A.`,
        affectedService: rate.propertyName,
        details: `Room type: ${rate.roomType}. Valid codes: ${[...RATE_CODE_SET].join(', ')}`,
      })
      continue // I8: skip row rather than emit with invented code
    }

    // I2: mismatch resolutions (contract form is authoritative)
    const validFrom = applyResolution('validFrom', rate.validFrom, mismatchResolutions)
    const validTo = applyResolution('validTo', rate.validTo, mismatchResolutions)
    const rateAmount = Number(
      applyResolution('rateAmount', String(rate.rateAmount), mismatchResolutions),
    )

    // Service match
    const match = findServiceMatch(rate.roomType, serviceMatches)
    if (!match) {
      flags.push({
        severity: 'needs_creation',
        code: 'NO_SERVICE_MATCH',
        message: `No PE service matched for room type "${rate.roomType}".`,
        affectedService: `${rate.propertyName} — ${rate.roomType}`,
      })
    }

    // I4: min/max from RATE_CODES → fallback constants
    const rateDef = RATE_CODES.find((r) => r.code === rate.rateCode)
    const minPax = rateDef?.minPax ?? MIN_PAX_FALLBACK
    const maxPax = rateDef?.maxPax ?? MAX_PAX_FALLBACK
    const minStay = rateDef?.minStay ?? MIN_STAY_FALLBACK
    const maxStay = rateDef?.maxStay ?? MAX_STAY_FALLBACK

    const childCost = rate.childRates.length > 0 ? rate.childRates[0].amount : 0

    rateRows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      service: match?.peServiceName ?? rate.roomType,
      serviceId: match?.peServiceId ?? 0,
      serviceCode: match?.peServiceCode ?? '',
      validFrom,
      validTo,
      agentGroupId: 0,
      rateCode: rate.rateCode,
      rateName: rateDef?.name ?? rate.rateCode,
      ratePlan: rate.seasonName,
      currencyBuy: 'USD',
      currencySell: 'USD',
      adultBuy: rateAmount,
      adultSell: rateAmount, // invariant: adultSell = adultBuy
      childCost,
      childSell: childCost, // invariant: childSell = childCost
      markup: 0,
      minPax,
      maxPax,
      minStay,
      maxStay,
      api: true,
      isActive: true,
      isException: false,
    })
  }

  // ── Policy rows (I6) ───────────────────────────────────────────────────────

  const ciorPolicy = extraction.policies.find((p) => p.type === 'CIOR')
  const ciorConfirmed = confirmedPolicies.find((cp) => cp.type === 'CIOR')
  if (ciorPolicy && ciorConfirmed?.confirmed) {
    // I6: CIOR → accommodation rate row
    const ciorDef = RATE_CODES.find((r) => r.code === 'CIOR')!
    const ciorMatch = findServiceMatch('CIOR', serviceMatches) ?? serviceMatches[0]
    rateRows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      service: ciorMatch?.peServiceName ?? 'Child In Own Room',
      serviceId: ciorMatch?.peServiceId ?? 0,
      serviceCode: ciorMatch?.peServiceCode ?? '',
      validFrom: extraction.contractPeriod.from,
      validTo: extraction.contractPeriod.to,
      agentGroupId: 0,
      rateCode: 'CIOR',
      rateName: ciorDef.name,
      ratePlan: 'Policy',
      currencyBuy: 'USD',
      currencySell: 'USD',
      adultBuy: 0,
      adultSell: 0,
      childCost: 0,
      childSell: 0,
      markup: 0,
      minPax: ciorDef.minPax,
      maxPax: ciorDef.maxPax,
      minStay: ciorDef.minStay,
      maxStay: ciorDef.maxStay,
      api: true,
      isActive: true,
      isException: false,
    })
  }

  const childSharingPolicy = extraction.policies.find((p) => p.type === 'children_sharing')
  const childSharingConfirmed = confirmedPolicies.find((cp) => cp.type === 'children_sharing')
  if (childSharingPolicy && childSharingConfirmed?.confirmed) {
    // I6: children_sharing → extras row
    // I7: check parent accommodation service exists
    if (accommodationServiceIds.size === 0) {
      flags.push({
        severity: 'needs_creation',
        code: 'CHILD_SHARING_NO_PARENT',
        message: 'Child-sharing policy cannot be emitted: no matched accommodation service.',
      })
    } else {
      extrasRows.push({
        supplierName: supplier.name,
        supplierId: supplier.supplier_id,
        supplierCode: supplier.code,
        service: 'Children Sharing',
        serviceId: extrasMatches[0]?.peServiceId ?? 0,
        serviceCode: extrasMatches[0]?.peServiceCode ?? '',
        validFrom: extraction.contractPeriod.from,
        validTo: extraction.contractPeriod.to,
        agentGroupId: 0,
        rateCode: 'CHD',
        rateName: 'Child',
        currencyBuy: 'USD',
        currencySell: 'USD',
        adultBuy: 0,
        adultSell: 0,
        childCost: 0,
        childSell: 0,
        markup: 0,
        minPax: 1,
        maxPax: 1,
        minStay: MIN_STAY_FALLBACK,
        maxStay: MAX_STAY_FALLBACK,
        api: true,
        isActive: true,
        isException: false,
        extraCategory: 'Child Policy',
        priceType: 'per_person',
      })
    }
  }

  // ── Extras rows from extras matches (I5, I7) ──────────────────────────────

  for (const extra of extrasMatches) {
    // I7: extras only if parent accommodation service exists
    if (accommodationServiceIds.size === 0) {
      flags.push({
        severity: 'needs_creation',
        code: 'EXTRAS_NO_PARENT',
        message: `Extra service "${extra.extractedName}" has no matched parent accommodation.`,
        affectedService: extra.extractedName,
      })
      continue
    }

    const isConservancy =
      extra.extractedName.toLowerCase().includes('conservancy') ||
      extra.extractedName.toLowerCase().includes('park fee') ||
      extra.extractedName.toLowerCase().includes('conservation')

    // I5: conservancy rows carry the lodge identity
    const serviceName = isConservancy
      ? `${extraction.properties[0] ?? supplier.name} — ${extra.extractedName}`
      : extra.extractedName

    if (extra.status === 'needs_creation') {
      flags.push({
        severity: 'needs_creation',
        code: 'EXTRA_SERVICE_MISSING',
        message: `Extra service "${extra.extractedName}" does not exist in PE and needs creation.`,
        affectedService: extra.extractedName,
      })
    }

    extrasRows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      service: serviceName,
      serviceId: extra.peServiceId ?? 0,
      serviceCode: extra.peServiceCode ?? '',
      validFrom: extraction.contractPeriod.from,
      validTo: extraction.contractPeriod.to,
      agentGroupId: 0,
      rateCode: 'CHD',
      rateName: 'Child',
      currencyBuy: 'USD',
      currencySell: 'USD',
      adultBuy: 0,
      adultSell: 0,
      childCost: 0,
      childSell: 0,
      markup: 0,
      minPax: MIN_PAX_FALLBACK,
      maxPax: MAX_PAX_FALLBACK,
      minStay: MIN_STAY_FALLBACK,
      maxStay: MAX_STAY_FALLBACK,
      api: true,
      isActive: true,
      isException: false,
      extraCategory: isConservancy ? 'Park / Conservancy Fee' : 'Extra',
      priceType: 'per_person',
    })
  }

  // ── Prior rate change flags ────────────────────────────────────────────────

  const enrichedPrior = enrichPriorRatesWithNew(
    prior,
    extraction,
    [...serviceMatches, ...extrasMatches],
  )

  for (const pr of enrichedPrior) {
    if (isHighRateChange(pr)) {
      flags.push({
        severity: 'rate_change',
        code: 'LARGE_RATE_CHANGE',
        message: `Rate for "${pr.serviceName}" changed by ${pr.percentChange!.toFixed(1)}% vs prior year.`,
        affectedService: pr.serviceName,
        details: `Prior: ${pr.adultCost} ${pr.currency}, New: ${pr.newRate ?? '—'}`,
      })
    }
  }

  // ── Needs-creation service flags ─────────────────────────────────────────

  for (const sm of serviceMatches) {
    if (sm.status === 'needs_creation') {
      flags.push({
        severity: 'needs_creation',
        code: 'ACCOMMODATION_SERVICE_MISSING',
        message: `Accommodation service "${sm.extractedName}" needs to be created in PE.`,
        affectedService: sm.extractedName,
      })
    }
  }

  // ── Sort rows ─────────────────────────────────────────────────────────────

  rateRows.sort((a, b) => {
    const byService = a.service.localeCompare(b.service)
    if (byService !== 0) return byService
    const byFrom = a.validFrom.localeCompare(b.validFrom)
    if (byFrom !== 0) return byFrom
    return a.rateCode.localeCompare(b.rateCode)
  })

  extrasRows.sort((a, b) => a.service.localeCompare(b.service))

  return { rateRows, extrasRows, flags }
}

export function resolveExportRows(session: ParseSession): {
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
} {
  if (session.outputRows.length > 0) {
    return {
      rateRows: session.outputRows,
      extrasRows: session.extrasRows,
      flags: session.validationFlags,
    }
  }
  return buildRows(session)
}

export function buildWorkbookBuffer(
  rateRows: RateRow[],
  extrasRows: ExtrasRow[],
  flags: ValidationFlag[],
): ArrayBuffer {
  const rateRecords = rateRows.map(rateRowToRecord)
  const extrasRecords = extrasRows.map(extrasRowToRecord)

  const wb = XLSX.utils.book_new()

  const wsRates = XLSX.utils.json_to_sheet(rateRecords, {
    header: [...RATES_COLUMNS],
    skipHeader: false,
  })
  XLSX.utils.book_append_sheet(wb, wsRates, 'Rates')

  const wsExtras = XLSX.utils.json_to_sheet(extrasRecords, {
    header: [...EXTRAS_COLUMNS, 'Business Model'],
    skipHeader: false,
  })
  XLSX.utils.book_append_sheet(wb, wsExtras, 'Extras')

  if (flags.length > 0) {
    const flagRecords = flags.map((f) => ({
      Severity: f.severity,
      Code: f.code,
      Message: f.message,
      'Affected Service': f.affectedService ?? '',
      Details: f.details ?? '',
    }))
    const wsFlags = XLSX.utils.json_to_sheet(flagRecords)
    XLSX.utils.book_append_sheet(wb, wsFlags, 'Validation')
  }

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const ab = new ArrayBuffer(buf.byteLength)
  new Uint8Array(ab).set(buf)
  return ab
}

export function buildWorkbookFromEditedRows(
  rateRows: RateRow[],
  extrasRows: ExtrasRow[],
  flags: ValidationFlag[],
): ArrayBuffer {
  return buildWorkbookBuffer(rateRows, extrasRows, flags)
}

export function generateExcel(session: ParseSession): ArrayBuffer {
  const { rateRows, extrasRows, flags } = resolveExportRows(session)
  return buildWorkbookBuffer(rateRows, extrasRows, flags)
}
