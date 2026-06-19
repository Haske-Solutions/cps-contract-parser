import type { DetectedSupplier, DetectionConfidence, SupplierDiscoveryResult } from '../../shared/types'

const CONFIDENCE_LEVELS = new Set<DetectionConfidence>(['high', 'medium', 'low'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DMY_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/

function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim()
  if (value === null || value === undefined) return fallback
  return String(value).trim()
}

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

function normalizeDetected(raw: unknown, index: number): DetectedSupplier {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Detected supplier ${index + 1} is malformed.`)
  }
  const entry = raw as Record<string, unknown>
  const extractedName = asString(entry.extractedName)
  if (!extractedName) {
    throw new Error(`Detected supplier ${index + 1} is missing extractedName.`)
  }

  const confidence = asString(entry.confidence, 'medium') as DetectionConfidence
  if (!CONFIDENCE_LEVELS.has(confidence)) {
    throw new Error(
      `Detected supplier "${extractedName}" has invalid confidence "${confidence}".`,
    )
  }

  const properties = Array.isArray(entry.properties)
    ? entry.properties.map((p) => asString(p)).filter(Boolean)
    : []

  const sectionHint = asString(entry.sectionHint) || undefined

  return { extractedName, properties, confidence, sectionHint }
}

export function normalizeDiscoveryResult(
  raw: unknown,
  fallbackAnchorTerm: string,
): SupplierDiscoveryResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Discovery returned an unexpected response format.')
  }

  const obj = raw as Record<string, unknown>
  const anchorTerm = asString(obj.anchorTerm, fallbackAnchorTerm) || fallbackAnchorTerm

  let contractPeriod: SupplierDiscoveryResult['contractPeriod']
  if (obj.contractPeriod && typeof obj.contractPeriod === 'object') {
    const period = obj.contractPeriod as Record<string, unknown>
    contractPeriod = {
      from: normalizeDate(period.from, 'contractPeriod.from'),
      to: normalizeDate(period.to, 'contractPeriod.to'),
    }
  }

  if (!Array.isArray(obj.detectedSuppliers)) {
    throw new Error('Discovery response is missing detectedSuppliers array.')
  }

  const detectedSuppliers = obj.detectedSuppliers.map(normalizeDetected)

  return { anchorTerm, contractPeriod, detectedSuppliers }
}
