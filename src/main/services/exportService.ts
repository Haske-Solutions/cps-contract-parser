import { lookupRateType, isValidRateTypeCode } from '../../shared/appendixA'
import {
  DEFAULT_BUSINESS_MODEL,
  DEFAULT_SUPPLIER_COMMISSION,
  OCCUPANCY_CODE_SET,
} from '../../shared/constants'
import { resolveBounds } from '../../shared/boundsResolver'
import { resolveAmount } from '../../shared/mismatchCollector'
import { enrichPriorRatesWithNew, isHighRateChange } from '../../shared/rateComparison'
import { validationFlagsToNotes } from '../../shared/validationNotes'
import type {
  ParseSession,
  RateRow,
  ExtrasRow,
  ValidationFlag,
  ValidationNote,
} from '../../shared/types'
import { buildCiorRows } from './ciorCalculator'
import { getExtractionValidationFlags } from './extractionValidation'
import { buildExtrasRows, isCiorService } from './extrasEngine'
import {
  buildNonAccommodationRows,
  inferAccommodationRateTypeCode,
} from './nonAccommodationBuilder'
import { buildPeWorkbookBuffer } from './peWorkbookWriter'
import { findMatchForRate } from '../../shared/serviceMatcher'

function sortRateRows(rows: RateRow[]): void {
  rows.sort((a, b) => {
    const byAccom = Number(a.isNonAccommodation ?? false) - Number(b.isNonAccommodation ?? false)
    if (byAccom !== 0) return byAccom
    const byService = a.serviceName.localeCompare(b.serviceName)
    if (byService !== 0) return byService
    const byFrom = a.dateFrom.localeCompare(b.dateFrom)
    if (byFrom !== 0) return byFrom
    return a.rateCode.localeCompare(b.rateCode)
  })
}

export function buildRows(session: ParseSession): {
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
  validationNotes: ValidationNote[]
} {
  const rateRows: RateRow[] = []
  const extrasRows: ExtrasRow[] = []
  const flags: ValidationFlag[] = []
  const validationNotes: ValidationNote[] = []

  if (!session.extraction || !session.supplier) {
    flags.push({
      severity: 'stop',
      code: 'MISSING_EXTRACTION',
      message: 'No extraction result or supplier — cannot generate rows.',
    })
    return { rateRows, extrasRows, flags, validationNotes: validationFlagsToNotes(flags) }
  }

  const {
    extraction,
    supplier,
    serviceMatches,
    extrasMatches,
    mismatchResolutions,
    confirmedPolicies,
    priorRates: prior,
  } = session

  flags.push(...getExtractionValidationFlags(extraction))

  const accommodationMatches = serviceMatches.filter(
    (m) => m.bucket === 'accommodation' || m.bucket === undefined,
  )

  for (const rate of extraction.rates) {
    if (rate.isNonAccommodation) continue

    const occupancy = rate.rateCode.toUpperCase()
    if (!OCCUPANCY_CODE_SET.has(occupancy) && !isValidRateTypeCode(occupancy)) {
      flags.push({
        severity: 'stop',
        code: 'INVALID_OCCUPANCY_CODE',
        message: `Occupancy code "${rate.rateCode}" is not recognized.`,
        affectedService: rate.propertyName,
      })
      continue
    }

    const match = findMatchForRate(rate, serviceMatches)
    if (match?.status !== 'matched') {
      if (match?.status === 'multiple_matches') {
        flags.push({
          severity: 'stop',
          code: 'ACCOMMODATION_SERVICE_AMBIGUOUS',
          message: `AMBIGUOUS MATCH: '${rate.roomType}' matches multiple PE services and has not been resolved.`,
          affectedService: `${rate.propertyName} — ${rate.roomType}`,
          details: `Proposed: ${rate.mealBasis} ${rate.roomType}`,
        })
      } else {
        flags.push({
          severity: 'needs_creation',
          code: 'ACCOMMODATION_SERVICE_MISSING',
          message: `NEEDS CREATION: contract prices '${rate.roomType}' but no matching in-use PE service.`,
          affectedService: `${rate.propertyName} — ${rate.roomType}`,
          details: `Proposed: ${rate.mealBasis} ${rate.roomType}`,
        })
      }
      continue
    }

    const rateTypeCode = inferAccommodationRateTypeCode(rate)
    if (!isValidRateTypeCode(rateTypeCode)) {
      flags.push({
        severity: 'stop',
        code: 'INVALID_RATE_TYPE',
        message: `Rate type "${rateTypeCode}" is not in Appendix A.`,
        affectedService: rate.propertyName,
      })
      continue
    }

    const dateFrom = resolveAmount(
      `accom:${rate.propertyName}:${rate.validFrom}:from`,
      rate.validFrom,
      rate.validFrom,
      mismatchResolutions,
    )
    const dateTo = resolveAmount(
      `accom:${rate.propertyName}:${rate.validTo}:to`,
      rate.validTo,
      rate.validTo,
      mismatchResolutions,
    )
    const rateAmount = Number(
      resolveAmount(
        `accom:${rate.propertyName}:${rate.validFrom}:amount`,
        String(rate.rateAmount),
        String(rate.rateAmount),
        mismatchResolutions,
      ),
    )

    const rateType = lookupRateType(rateTypeCode)!
    const bounds = resolveBounds({
      rateTypeCode,
      contractConstraints: extraction.contractConstraints,
      validFrom: dateFrom,
      validTo: dateTo,
      rateConstraints: {
        minStay: rate.minStay,
        maxStay: rate.maxStay,
        minPax: rate.minPax,
        maxPax: rate.maxPax,
      },
    })

    if (bounds.overrideLogged) {
      validationNotes.push({
        itemType: 'Policy Override',
        serviceName: match?.peServiceName ?? rate.roomType,
        issue: bounds.overrideLogged,
        actionRequired: 'Contract value applied to Min/Max fields',
      })
    }

    const childCost =
      isCiorService(match?.peServiceName) && rate.childRates.length > 0
        ? rate.childRates[0].amount
        : 0

    rateRows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      serviceName: match?.peServiceName ?? rate.roomType,
      serviceId: match?.peServiceId ?? 0,
      serviceCode: match?.peServiceCode ?? '',
      dateFrom,
      dateTo,
      agentGroupId: 0,
      rateCode: rateTypeCode,
      rateName: rateType.name,
      ratePlan: rateTypeCode,
      currencyCode: 'USD',
      adultBuy: rateAmount,
      adultSell: rateAmount,
      childCost,
      childSell: childCost,
      markup: 0,
      minPax: bounds.minPax,
      maxPax: bounds.maxPax,
      minStay: bounds.minStay,
      maxStay: bounds.maxStay,
      api: true,
      isException: false,
      businessModel: DEFAULT_BUSINESS_MODEL,
      supplierCommission: DEFAULT_SUPPLIER_COMMISSION,
    })
  }

  for (const cior of buildCiorRows(extraction, confirmedPolicies)) {
    const ciorMealBasis = cior.serviceName.split(' ')[0].toUpperCase()
    const ciorMatch =
      serviceMatches.find(
        (m) =>
          m.peServiceName?.toUpperCase().includes('CIOR') &&
          m.peServiceName.toUpperCase().startsWith(ciorMealBasis),
      ) ??
      serviceMatches.find((m) => m.peServiceName?.toUpperCase().includes('CIOR')) ??
      serviceMatches[0]
    const rateType = lookupRateType(cior.rateTypeCode) ?? lookupRateType('PPPN')!

    rateRows.push({
      supplierName: supplier.name,
      supplierId: supplier.supplier_id,
      supplierCode: supplier.code,
      serviceName: ciorMatch?.peServiceName ?? cior.serviceName,
      serviceId: ciorMatch?.peServiceId ?? 0,
      serviceCode: ciorMatch?.peServiceCode ?? '',
      dateFrom: cior.validFrom,
      dateTo: cior.validTo,
      agentGroupId: 0,
      rateCode: cior.rateTypeCode,
      rateName: rateType.name,
      ratePlan: cior.rateTypeCode,
      currencyCode: 'USD',
      adultBuy: 0,
      adultSell: 0,
      childCost: cior.childCost,
      childSell: cior.childCost,
      markup: 0,
      minPax: cior.minPax,
      maxPax: rateType.maxPax,
      minStay: rateType.minStay,
      maxStay: rateType.maxStay,
      api: true,
      isException: false,
      businessModel: DEFAULT_BUSINESS_MODEL,
      supplierCommission: DEFAULT_SUPPLIER_COMMISSION,
    })
  }

  rateRows.push(
    ...buildNonAccommodationRows(
      extraction,
      supplier,
      serviceMatches,
      mismatchResolutions,
      validationNotes,
    ),
  )

  extrasRows.push(
    ...buildExtrasRows(
      extraction,
      supplier,
      accommodationMatches,
      extrasMatches,
      confirmedPolicies,
    ),
  )

  const enrichedPrior = enrichPriorRatesWithNew(prior, extraction, [
    ...serviceMatches,
    ...extrasMatches,
  ])
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

  if (extrasRows.length === 0 && (extraction.parkFees?.length || extraction.festiveTerms?.length)) {
    validationNotes.push({
      itemType: 'Extras',
      serviceName: supplier.name,
      issue: 'Extras section omitted — no parent accommodation matches',
      actionRequired: 'Match accommodation services to generate extras',
    })
  }

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

  sortRateRows(rateRows)

  const allNotes = [...validationNotes, ...validationFlagsToNotes(flags)]
  return { rateRows, extrasRows, flags, validationNotes: allNotes }
}

export function resolveExportRows(session: ParseSession): {
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
  validationNotes: ValidationNote[]
} {
  if (session.outputRows.length > 0) {
    return {
      rateRows: session.outputRows,
      extrasRows: session.extrasRows,
      flags: session.validationFlags,
      validationNotes: validationFlagsToNotes(session.validationFlags),
    }
  }
  return buildRows(session)
}

export async function buildWorkbookBuffer(
  rateRows: RateRow[],
  extrasRows: ExtrasRow[],
  flags: ValidationFlag[],
  validationNotes?: ValidationNote[],
): Promise<ArrayBuffer> {
  const notes = validationNotes ?? validationFlagsToNotes(flags)
  return buildPeWorkbookBuffer(rateRows, extrasRows, notes)
}

export async function buildWorkbookFromEditedRows(
  rateRows: RateRow[],
  extrasRows: ExtrasRow[],
  flags: ValidationFlag[],
): Promise<ArrayBuffer> {
  return buildWorkbookBuffer(rateRows, extrasRows, flags)
}

export async function generateExcel(session: ParseSession): Promise<{
  buffer: ArrayBuffer
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
  validationNotes: ValidationNote[]
}> {
  const { rateRows, extrasRows, flags, validationNotes } = resolveExportRows(session)
  const buffer = await buildWorkbookBuffer(rateRows, extrasRows, flags, validationNotes)
  return { buffer, rateRows, extrasRows, flags, validationNotes }
}
