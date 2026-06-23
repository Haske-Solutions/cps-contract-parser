import type { ExtractedRate, PEService, ServiceBucket } from './types'

export interface TokenSet {
  mealBasis: Set<string>
  roomTypes: Set<string>
  policyTiers: Set<string>
  ageBrackets: Set<string>
  markers: Set<string>
  nouns: Set<string>
}

export type MatchStatus = 'matched' | 'ambiguous' | 'needs_creation' | 'fuzzy_match'

export interface MatchResult {
  status: MatchStatus
  service?: PEService
  candidates: PEService[]
  score: number
}

const MEAL_BASIS_TOKENS = ['FB', 'GPKG', 'BB', 'AI', 'HB', 'RO', 'FI', 'GFBI', 'GP'] as const

const ROOM_TOKENS = [
  'DOUBLE',
  'TWIN',
  'SINGLE',
  'TRIPLE',
  'QUAD',
  'QUADRUPLE',
  'FAMILY',
  'SUITE',
  'COTTAGE',
  'TENT',
  'BANDA',
  'VILLA',
  'HOUSE',
  'HONEYMOON',
  'SAFARI',
  'MANOR',
  'STAR',
  'BED',
  'GUIDE',
  'PILOT',
] as const

const MEAL_PHRASE_PATTERNS: ReadonlyArray<{ pattern: RegExp; token: string }> = [
  { pattern: /\bFULL\s+BOARD\b/i, token: 'FB' },
  { pattern: /\bHALF\s+BOARD\b/i, token: 'HB' },
  { pattern: /\bBED\s*(?:&|AND)\s*BREAKFAST\b/i, token: 'BB' },
  { pattern: /\bALL\s+INCLUSIVE\b/i, token: 'AI' },
  { pattern: /\bGAME\s+PACKAGE\b/i, token: 'GPKG' },
]

const FUZZY_MATCH_THRESHOLD = 0.75

function tokenizeText(text: string): string[] {
  return text
    .toUpperCase()
    .replace(/[()]/g, ' ')
    .split(/[\s,/\-–—]+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

export function tokenizePeServiceName(name: string): TokenSet {
  const tokens = tokenizeText(name)
  const set: TokenSet = {
    mealBasis: new Set(),
    roomTypes: new Set(),
    policyTiers: new Set(),
    ageBrackets: new Set(),
    markers: new Set(),
    nouns: new Set(),
  }

  for (const t of tokens) {
    if ((MEAL_BASIS_TOKENS as readonly string[]).includes(t)) set.mealBasis.add(t)
    if ((ROOM_TOKENS as readonly string[]).includes(t)) set.roomTypes.add(t)
    if (t === 'CIOR') set.markers.add('CIOR')
    if (t === 'MIN' || /^\d+$/.test(t)) set.policyTiers.add(t)
    if (t === 'CHILD' || t === 'INFANT' || t === 'ADULT' || t === 'YRS') set.ageBrackets.add(t)
    set.nouns.add(t)
  }

  const tierMatch = name.match(/\(([^)]+)\)/)
  if (tierMatch) {
    for (const part of tokenizeText(tierMatch[1])) set.policyTiers.add(part)
  }

  const ageMatch = name.match(/Child\s*\(([^)]+)\)/i)
  if (ageMatch) {
    for (const part of tokenizeText(ageMatch[1])) set.ageBrackets.add(part)
  }

  for (const { pattern, token } of MEAL_PHRASE_PATTERNS) {
    if (pattern.test(name)) set.mealBasis.add(token)
  }

  return set
}

export function tokenizeRateRecord(rate: ExtractedRate, policyTier?: string): TokenSet {
  const combined = [rate.mealBasis, rate.roomType, policyTier ?? '']
    .filter(Boolean)
    .join(' ')
  const set = tokenizePeServiceName(combined)
  if (rate.rateCode.toUpperCase() === 'CIOR') set.markers.add('CIOR')
  return set
}

function unionSize(a: Set<string>, b: Set<string>): number {
  return new Set([...a, ...b]).size
}

function coverageScore(record: TokenSet, service: TokenSet): number {
  const required = new Set([
    ...record.mealBasis,
    ...record.roomTypes,
    ...record.markers,
    ...record.policyTiers,
    ...record.ageBrackets,
  ])
  const serviceAll = new Set([
    ...service.mealBasis,
    ...service.roomTypes,
    ...service.markers,
    ...service.policyTiers,
    ...service.ageBrackets,
    ...service.nouns,
  ])

  if (required.size === 0) return 0

  let covered = 0
  for (const t of required) {
    if (serviceAll.has(t)) covered++
  }
  if (covered < required.size) return 0

  const recordAll = new Set([...required, ...record.nouns])
  const extraTokens = unionSize(recordAll, serviceAll) - recordAll.size
  return 1000 - extraTokens
}

export function scoreServiceMatch(record: TokenSet, serviceName: string): number {
  return coverageScore(record, tokenizePeServiceName(serviceName))
}

function requiredTokenSet(record: TokenSet): Set<string> {
  return new Set([
    ...record.mealBasis,
    ...record.roomTypes,
    ...record.markers,
    ...record.policyTiers,
    ...record.ageBrackets,
  ])
}

function serviceTokenUnion(service: TokenSet): Set<string> {
  return new Set([
    ...service.mealBasis,
    ...service.roomTypes,
    ...service.markers,
    ...service.policyTiers,
    ...service.ageBrackets,
    ...service.nouns,
  ])
}

/** Partial token coverage (0–1) for fuzzy fallback when strict match fails. */
export function partialCoverageScore(record: TokenSet, serviceName: string): number {
  const required = requiredTokenSet(record)
  if (required.size === 0) return 0

  const serviceAll = serviceTokenUnion(tokenizePeServiceName(serviceName))
  let covered = 0
  for (const t of required) {
    if (serviceAll.has(t)) covered++
  }
  return covered / required.size
}

export function matchRateToServices(
  rate: ExtractedRate,
  services: PEService[],
  _bucket: ServiceBucket,
  policyTier?: string,
): MatchResult {
  const recordTokens = tokenizeRateRecord(rate, policyTier)
  const scored = services
    .map((s) => ({ service: s, score: scoreServiceMatch(recordTokens, s.name) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length === 0) {
    const fuzzyScored = services
      .map((s) => ({
        service: s,
        score: partialCoverageScore(recordTokens, s.name),
      }))
      .filter((x) => x.score >= FUZZY_MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)

    if (fuzzyScored.length === 0) {
      return { status: 'needs_creation', candidates: [], score: 0 }
    }

    const fuzzyTop = fuzzyScored[0]
    const fuzzyTied = fuzzyScored.filter((x) => x.score === fuzzyTop.score)

    if (fuzzyTied.length > 1) {
      return {
        status: 'ambiguous',
        candidates: fuzzyTied.map((x) => x.service),
        score: fuzzyTop.score,
      }
    }

    return {
      status: 'fuzzy_match',
      service: fuzzyTop.service,
      candidates: [fuzzyTop.service],
      score: fuzzyTop.score,
    }
  }

  const top = scored[0]
  const tied = scored.filter((x) => x.score === top.score)

  if (tied.length > 1) {
    return {
      status: 'ambiguous',
      candidates: tied.map((x) => x.service),
      score: top.score,
    }
  }

  return {
    status: 'matched',
    service: top.service,
    candidates: [top.service],
    score: top.score,
  }
}

export function rateRecordKey(rate: ExtractedRate): string {
  return `${rate.propertyName}|${rate.roomType}|${rate.mealBasis}|${rate.validFrom}|${rate.seasonName}`
}

export interface RateRecordKeyParts {
  propertyName: string
  roomType: string
  mealBasis: string
  validFrom: string
  seasonName: string
}

/** True when `extractedName` is the internal pipe-delimited accommodation key. */
export function isRateRecordKey(value: string): boolean {
  return parseRateRecordKey(value) !== null
}

export function parseRateRecordKey(key: string): RateRecordKeyParts | null {
  const parts = key.split('|')
  if (parts.length !== 5) return null
  const [propertyName, roomType, mealBasis, validFrom, seasonName] = parts
  if (!propertyName || !roomType || !mealBasis || !validFrom) return null
  return { propertyName, roomType, mealBasis, validFrom, seasonName: seasonName ?? '' }
}

/** Human-readable single-line label for the service-matching grid. */
export function formatRateRecordKeyLabel(key: string): string {
  const parts = parseRateRecordKey(key)
  if (!parts) return key

  const season = parts.seasonName ? ` · ${parts.seasonName}` : ''
  return `${parts.propertyName} — ${parts.mealBasis} ${parts.roomType}${season}`
}

/** Multi-line tooltip body with the full extracted rate identity. */
export function formatRateRecordKeyTooltip(key: string): string {
  const parts = parseRateRecordKey(key)
  if (!parts) return key

  return [
    `Property: ${parts.propertyName}`,
    `Room: ${parts.roomType}`,
    `Meal basis: ${parts.mealBasis}`,
    `Season: ${parts.seasonName || '—'}`,
    `Valid from: ${parts.validFrom}`,
  ].join('\n')
}
