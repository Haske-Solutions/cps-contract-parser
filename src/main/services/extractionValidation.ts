import type { ExtractionResult, ExtractedRate, ExtractedPolicy, ChildSharingBracket, AdditionalPaxSupplement, ValidationFlag, ExtractionBatchResult } from '../../shared/types'

const POLICY_TYPES = new Set<ExtractedPolicy['type']>([
  'CIOR',
  'children_sharing',
  'single_room',
  'free_child',
  'age_brackets',
  'triple_quad',
])

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DMY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function normalizeDate(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing or invalid date for ${field}. Expected YYYY-MM-DD or DD/MM/YYYY.`)
  }
  const trimmed = value.trim()
  if (ISO_DATE.test(trimmed)) return trimmed

  const dmy = trimmed.match(DMY_DATE)
  if (dmy) {
    const [, day, month, year] = dmy
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  throw new Error(`Could not parse date "${trimmed}" for ${field}. Use YYYY-MM-DD or DD/MM/YYYY.`)
}

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return fallback
  return String(value).trim()
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function normalizeChildRates(raw: unknown): ExtractedRate['childRates'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const child = entry as Record<string, unknown>
    return {
      ageFrom: asNumber(child.ageFrom),
      ageTo: asNumber(child.ageTo),
      amount: asNumber(child.amount),
      rateCode: asString(child.rateCode, 'CHD'),
    }
  })
}

function normalizeRate(raw: unknown, index: number): ExtractedRate {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Rate row ${index + 1} is malformed. Please retry extraction.`)
  }
  const rate = raw as Record<string, unknown>

  return {
    propertyName: asString(rate.propertyName),
    roomType: asString(rate.roomType),
    mealBasis: asString(rate.mealBasis),
    seasonName: asString(rate.seasonName),
    validFrom: normalizeDate(rate.validFrom, `rates[${index}].validFrom`),
    validTo: normalizeDate(rate.validTo, `rates[${index}].validTo`),
    rateAmount: asNumber(rate.rateAmount),
    currency: asString(rate.currency, 'USD') || 'USD',
    rateCode: asString(rate.rateCode).toUpperCase(),
    rateTypeCode: asString(rate.rateTypeCode).toUpperCase() || undefined,
    occupancyRules: asString(rate.occupancyRules),
    childRates: normalizeChildRates(rate.childRates),
    singleSupplement:
      rate.singleSupplement === null || rate.singleSupplement === undefined
        ? null
        : asNumber(rate.singleSupplement),
    notes: asString(rate.notes),
    minStay: rate.minStay == null ? undefined : asNumber(rate.minStay),
    maxStay: rate.maxStay == null ? undefined : asNumber(rate.maxStay),
    minPax: rate.minPax == null ? undefined : asNumber(rate.minPax),
    maxPax: rate.maxPax == null ? undefined : asNumber(rate.maxPax),
    isNonAccommodation: rate.isNonAccommodation === true,
    adultSell: rate.adultSell == null ? undefined : asNumber(rate.adultSell),
  }
}

function normalizeCrossChecks(raw: unknown): ExtractionResult['crossChecks'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry, i) => {
    const cc = entry as Record<string, unknown>
    return {
      id: asString(cc.id, `crosscheck-${i}`),
      section: asString(cc.section, 'General'),
      field: asString(cc.field, 'value'),
      formValue: asString(cc.formValue),
      pdfValue: asString(cc.pdfValue),
      rateRef: asString(cc.rateRef) || undefined,
    }
  })
}

function normalizeNonAccommodationRates(raw: unknown): ExtractionResult['nonAccommodationRates'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const na = entry as Record<string, unknown>
    return {
      description: asString(na.description),
      rateTypeCode: asString(na.rateTypeCode, 'PPPN').toUpperCase(),
      cost: asNumber(na.cost),
      sell: asNumber(na.sell, asNumber(na.cost)),
      released: na.released !== false,
      childCost: na.childCost == null ? undefined : asNumber(na.childCost),
      validFrom: normalizeDate(na.validFrom, 'nonAccommodation.validFrom'),
      validTo: normalizeDate(na.validTo, 'nonAccommodation.validTo'),
      notes: asString(na.notes),
      isDriverGuide: na.isDriverGuide === true,
    }
  })
}

function normalizeParkFees(raw: unknown): ExtractionResult['parkFees'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const pf = entry as Record<string, unknown>
    const brackets = Array.isArray(pf.childBrackets) ? pf.childBrackets : []
    return {
      name: asString(pf.name),
      parentMealBasis: asString(pf.parentMealBasis, 'GPKG'),
      adultAmount: asNumber(pf.adultAmount),
      childBrackets: brackets.map((b) => {
        const br = b as Record<string, unknown>
        return {
          ageFrom: asNumber(br.ageFrom),
          ageTo: asNumber(br.ageTo),
          amount: asNumber(br.amount),
        }
      }),
      validFrom: normalizeDate(pf.validFrom, 'parkFee.validFrom'),
      validTo: normalizeDate(pf.validTo, 'parkFee.validTo'),
    }
  })
}

function normalizeFestiveTerms(raw: unknown): ExtractionResult['festiveTerms'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const ft = entry as Record<string, unknown>
    const type = asString(ft.type, 'other') as 'christmas' | 'new_year' | 'gala' | 'other'
    return {
      type,
      adultAmount: asNumber(ft.adultAmount),
      childAmount: ft.childAmount == null ? undefined : asNumber(ft.childAmount),
      validFrom: normalizeDate(ft.validFrom, 'festive.validFrom'),
      validTo: normalizeDate(ft.validTo, 'festive.validTo'),
      mandatory: ft.mandatory !== false,
      verbatimText: asString(ft.verbatimText),
      needsClarification: ft.needsClarification === true,
    }
  })
}

function normalizeContractConstraints(raw: unknown): ExtractionResult['contractConstraints'] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const c = entry as Record<string, unknown>
    return {
      minStay: c.minStay == null ? undefined : asNumber(c.minStay),
      maxStay: c.maxStay == null ? undefined : asNumber(c.maxStay),
      minPax: c.minPax == null ? undefined : asNumber(c.minPax),
      maxPax: c.maxPax == null ? undefined : asNumber(c.maxPax),
      dateBandFrom: c.dateBandFrom == null ? undefined : normalizeDate(c.dateBandFrom, 'constraint.dateBandFrom'),
      dateBandTo: c.dateBandTo == null ? undefined : normalizeDate(c.dateBandTo, 'constraint.dateBandTo'),
      scope: asString(c.scope) || undefined,
    }
  })
}

function normalizeCurrencies(raw: unknown): ExtractionResult['currencies'] {
  if (!Array.isArray(raw)) return [{ code: 'USD', isPrimary: true }]
  return raw.map((entry) => {
    const c = entry as Record<string, unknown>
    return {
      code: asString(c.code, 'USD') || 'USD',
      isPrimary: c.isPrimary !== false,
    }
  })
}

function normalizeChildSharingBrackets(raw: unknown): ChildSharingBracket[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const bracket = entry as Record<string, unknown>
    const passengerType = asString(bracket.passengerType, 'child')
    const adultsSharingWithRaw = bracket.adultsSharingWith
    let adultsSharingWith: ChildSharingBracket['adultsSharingWith'] = null
    if (adultsSharingWithRaw === 1 || adultsSharingWithRaw === 2) {
      adultsSharingWith = adultsSharingWithRaw
    } else if (adultsSharingWithRaw === '1') {
      adultsSharingWith = 1
    } else if (adultsSharingWithRaw === '2') {
      adultsSharingWith = 2
    }

    return {
      ageFrom: asNumber(bracket.ageFrom),
      ageTo: asNumber(bracket.ageTo),
      passengerType: passengerType === 'infant' ? 'infant' : 'child',
      adultsSharingWith,
      percentOfAdult:
        bracket.percentOfAdult == null || bracket.percentOfAdult === ''
          ? null
          : asNumber(bracket.percentOfAdult),
      flatCost:
        bracket.flatCost == null || bracket.flatCost === ''
          ? null
          : asNumber(bracket.flatCost),
    }
  })
}

function normalizeAdditionalPaxSupplements(raw: unknown): AdditionalPaxSupplement[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const supplement = entry as Record<string, unknown>
    const passengerType = asString(supplement.passengerType, 'adult')
    return {
      parentRoomType: asString(supplement.parentRoomType),
      mealBasis: asString(supplement.mealBasis) || undefined,
      propertyName: asString(supplement.propertyName) || undefined,
      passengerType:
        passengerType === 'child' ? 'child' : passengerType === 'infant' ? 'infant' : 'adult',
      ageFrom: supplement.ageFrom == null ? undefined : asNumber(supplement.ageFrom),
      ageTo: supplement.ageTo == null ? undefined : asNumber(supplement.ageTo),
      percentOfAdult:
        supplement.percentOfAdult == null || supplement.percentOfAdult === ''
          ? null
          : asNumber(supplement.percentOfAdult),
      flatCost:
        supplement.flatCost == null || supplement.flatCost === ''
          ? null
          : asNumber(supplement.flatCost),
      validFrom: normalizeDate(supplement.validFrom, 'additionalPax.validFrom'),
      validTo: normalizeDate(supplement.validTo, 'additionalPax.validTo'),
    }
  })
}

function normalizePolicy(raw: unknown, index: number): ExtractedPolicy {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Policy row ${index + 1} is malformed. Please retry extraction.`)
  }
  const policy = raw as Record<string, unknown>
  const type = asString(policy.type) as ExtractedPolicy['type']

  if (!POLICY_TYPES.has(type)) {
    throw new Error(
      `Policy row ${index + 1} has unknown type "${type}". Expected one of: ${[...POLICY_TYPES].join(', ')}.`,
    )
  }

  return {
    type,
    verbatimText: asString(policy.verbatimText),
    interpretation: asString(policy.interpretation),
    calculationApplied: asString(policy.calculationApplied),
    peServicesAffected: Array.isArray(policy.peServicesAffected)
      ? policy.peServicesAffected.map((s) => asString(s)).filter(Boolean)
      : [],
    confirmed: false,
    childBrackets:
      type === 'children_sharing' ? normalizeChildSharingBrackets(policy.childBrackets) : undefined,
  }
}

function isLegacySingleSupplierPayload(obj: Record<string, unknown>): boolean {
  return 'supplierName' in obj && !('suppliers' in obj)
}

/** Validates and normalizes one supplier object from the suppliers array. */
export function normalizeSupplierExtraction(raw: unknown, supplierIndex = 0): ExtractionResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error(
      `Supplier entry ${supplierIndex + 1} is malformed. Please verify both PDFs and try again.`,
    )
  }

  const obj = raw as Record<string, unknown>
  const supplierName = asString(obj.supplierName)
  if (!supplierName) {
    throw new Error(
      `Supplier entry ${supplierIndex + 1} is missing a supplier name. Please verify both PDFs and try again.`,
    )
  }

  const peSupplierId =
    obj.peSupplierId === null || obj.peSupplierId === undefined
      ? null
      : asNumber(obj.peSupplierId, NaN)
  const peSupplierCode = asString(obj.peSupplierCode) || null

  const periodRaw = obj.contractPeriod
  if (!periodRaw || typeof periodRaw !== 'object') {
    throw new Error(
      `Supplier "${supplierName}" is missing a contract period. Please retry extraction.`,
    )
  }
  const period = periodRaw as Record<string, unknown>
  const contractPeriod = {
    from: normalizeDate(period.from, `suppliers[${supplierIndex}].contractPeriod.from`),
    to: normalizeDate(period.to, `suppliers[${supplierIndex}].contractPeriod.to`),
  }

  const properties = Array.isArray(obj.properties)
    ? obj.properties.map((p) => asString(p)).filter(Boolean)
    : []

  if (!Array.isArray(obj.rates)) {
    throw new Error(
      `Supplier "${supplierName}" is missing a rates array. Please retry extraction.`,
    )
  }
  if (!Array.isArray(obj.policies)) {
    throw new Error(
      `Supplier "${supplierName}" is missing a policies array. Please retry extraction.`,
    )
  }

  return {
    supplierName,
    peSupplierId: Number.isFinite(peSupplierId) ? peSupplierId : null,
    peSupplierCode,
    contractPeriod,
    properties,
    rates: obj.rates.map(normalizeRate),
    policies: obj.policies.map(normalizePolicy),
    nonAccommodationRates: normalizeNonAccommodationRates(obj.nonAccommodationRates),
    additionalPaxSupplements: normalizeAdditionalPaxSupplements(obj.additionalPaxSupplements),
    parkFees: normalizeParkFees(obj.parkFees),
    festiveTerms: normalizeFestiveTerms(obj.festiveTerms),
    contractConstraints: normalizeContractConstraints(obj.contractConstraints),
    crossChecks: normalizeCrossChecks(obj.crossChecks),
    currencies: normalizeCurrencies(obj.currencies),
  }
}

/** Validates and normalizes a raw Claude JSON payload into a multi-supplier batch. */
export function normalizeExtractionBatch(raw: unknown): ExtractionBatchResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error(
      'The AI returned an unexpected response format. Please verify both PDFs and try again.',
    )
  }

  const obj = raw as Record<string, unknown>

  if (isLegacySingleSupplierPayload(obj)) {
    return { suppliers: [normalizeSupplierExtraction(obj, 0)] }
  }

  if (!Array.isArray(obj.suppliers) || obj.suppliers.length === 0) {
    throw new Error(
      'Could not identify any supplier contracts in the documents. Please verify both PDFs are correct and try again.',
    )
  }

  return {
    suppliers: obj.suppliers.map((entry, index) => normalizeSupplierExtraction(entry, index)),
  }
}

/** @deprecated Use normalizeExtractionBatch — kept for tests that assert a single supplier payload. */
export function normalizeExtraction(raw: unknown): ExtractionResult {
  return normalizeExtractionBatch(raw).suppliers[0]!
}

/** Flags ambiguous or incomplete extraction fields for the validation report. */
export function getExtractionValidationFlags(extraction: ExtractionResult): ValidationFlag[] {
  const flags: ValidationFlag[] = []

  if (extraction.rates.length === 0) {
    flags.push({
      severity: 'info',
      code: 'NO_RATES_EXTRACTED',
      message: 'No accommodation rates were extracted from the PDFs.',
    })
  }

  if (extraction.policies.length === 0) {
    flags.push({
      severity: 'info',
      code: 'NO_POLICIES_EXTRACTED',
      message: 'No child policies were found. CIOR services will not be loaded for this session.',
    })
  }

  for (const rate of extraction.rates) {
    const label = `${rate.propertyName} — ${rate.roomType || 'unknown room'}`
    const missing: string[] = []
    if (!rate.mealBasis) missing.push('meal basis')
    if (!rate.seasonName) missing.push('season')
    if (!rate.occupancyRules) missing.push('occupancy rules')
    if (!rate.rateCode) missing.push('rate code')

    if (missing.length > 0) {
      flags.push({
        severity: 'info',
        code: 'AMBIGUOUS_RATE_FIELDS',
        message: `Some fields could not be determined for "${label}".`,
        affectedService: label,
        details: `Missing or empty: ${missing.join(', ')}`,
      })
    }
  }

  for (const policy of extraction.policies) {
    if (!policy.verbatimText || !policy.interpretation) {
      flags.push({
        severity: 'info',
        code: 'AMBIGUOUS_POLICY',
        message: `Policy "${policy.type}" is incomplete and needs manual review during confirmation.`,
        details: [
          !policy.verbatimText ? 'verbatim text missing' : null,
          !policy.interpretation ? 'interpretation missing' : null,
        ]
          .filter(Boolean)
          .join('; '),
      })
    }
  }

  return flags
}
