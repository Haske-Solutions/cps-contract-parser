import type { ExtractionResult, ExtractedRate, ExtractedPolicy, ValidationFlag, ExtractionBatchResult } from '../../shared/types'

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
    occupancyRules: asString(rate.occupancyRules),
    childRates: normalizeChildRates(rate.childRates),
    singleSupplement:
      rate.singleSupplement === null || rate.singleSupplement === undefined
        ? null
        : asNumber(rate.singleSupplement),
    notes: asString(rate.notes),
  }
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
