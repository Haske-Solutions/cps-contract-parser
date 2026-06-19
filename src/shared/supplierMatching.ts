import type {
  DetectedSupplier,
  DetectionConfidence,
  PropertyMappingGroup,
  Supplier,
  SupplierMapping,
} from './types'

const GENERIC_TOKENS = new Set([
  'camp',
  'camps',
  'lodge',
  'lodges',
  'hotel',
  'hotels',
  'house',
  'tented',
  'safari',
  'safaris',
  'resort',
  'resorts',
  'the',
  'and',
  'by',
  'inn',
  'suite',
  'suites',
  'villa',
  'villas',
  'manor',
])

const GROUP_NAME_PATTERN =
  /collection|group|portfolio|safaris|lodges|camps|hotels|accommodation|properties/i

const MATCH_THRESHOLD = 0.34

export function normalizeSupplierName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

function coreTokens(value: string): Set<string> {
  return new Set(
    normalizeSupplierName(value)
      .split(' ')
      .filter((t) => t.length > 2 && !GENERIC_TOKENS.has(t)),
  )
}

function tokenOverlapScore(a: string, b: string): number {
  const tokensA = coreTokens(a)
  const tokensB = coreTokens(b)
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let overlap = 0
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap++
  }
  return overlap / Math.max(tokensA.size, tokensB.size)
}

export interface SemanticMatchResult {
  score: number
  confidence: DetectionConfidence
}

/** Score how well a PDF label matches a PE supplier name (brand prefix not required). */
export function semanticMatchScore(pdfLabel: string, peName: string): SemanticMatchResult {
  const a = normalizeSupplierName(pdfLabel)
  const b = normalizeSupplierName(peName)

  if (!a || !b) return { score: 0, confidence: 'low' }
  if (a === b) return { score: 1, confidence: 'high' }
  if (a.includes(b) || b.includes(a)) return { score: 0.9, confidence: 'high' }

  const coreOverlap = tokenOverlapScore(pdfLabel, peName)
  if (coreOverlap >= 0.75) return { score: coreOverlap, confidence: 'high' }
  if (coreOverlap >= 0.5) return { score: coreOverlap, confidence: 'medium' }
  if (coreOverlap >= 0.34) return { score: coreOverlap, confidence: 'low' }

  const allTokenOverlap = tokenOverlapScore(
    pdfLabel.replace(/\b(camp|lodge|hotel|tented|house)\b/gi, ' '),
    peName.replace(/\b(camp|lodge|hotel|tented|house)\b/gi, ' '),
  )
  if (allTokenOverlap >= 0.5) {
    return { score: allTokenOverlap * 0.85, confidence: 'medium' }
  }

  return { score: Math.max(coreOverlap, allTokenOverlap * 0.5), confidence: 'low' }
}

function detectionLabels(det: DetectedSupplier): string[] {
  const labels = new Set<string>()
  const add = (value: string | undefined) => {
    const trimmed = value?.trim()
    if (trimmed) labels.add(trimmed)
  }

  add(det.extractedName)
  for (const property of det.properties) add(property)

  return [...labels]
}

function bestPeMatchForLabels(
  labels: string[],
  pe: Supplier,
): SemanticMatchResult & { label: string } {
  let best: (SemanticMatchResult & { label: string }) | null = null

  for (const label of labels) {
    const result = semanticMatchScore(label, pe.name)
    if (!best || result.score > best.score) {
      best = { ...result, label }
    }
    const codeResult = semanticMatchScore(label, pe.code)
    if (codeResult.score > (best?.score ?? 0)) {
      best = { ...codeResult, label }
    }
  }

  return best ?? { score: 0, confidence: 'low', label: labels[0] ?? '' }
}

function isGroupDetection(det: DetectedSupplier): boolean {
  if (det.properties.length > 1) return true
  return GROUP_NAME_PATTERN.test(det.extractedName)
}

/** Split bundled property strings (comma-separated) into individual property names. */
export function splitPropertyLabel(value: string): string[] {
  if (!value.trim()) return []

  const segments = value
    .split(/\s*(?:,|;|\band\b)\s+/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2)

  return segments.length > 0 ? segments : [value.trim()]
}

/** Normalize discovery rows so each property is a discrete label. */
export function normalizeDetectedSuppliers(detected: DetectedSupplier[]): DetectedSupplier[] {
  return detected.map((det) => {
    const properties = det.properties.flatMap(splitPropertyLabel).filter(Boolean)
    const unique = [...new Set(properties)]

    if (unique.length > 0) {
      return { ...det, properties: unique }
    }

    return { ...det, properties: [det.extractedName] }
  })
}

function allPropertyLabelsInDetection(det: DetectedSupplier): string[] {
  return [...new Set([det.extractedName, ...det.properties].filter(Boolean))]
}

export function propertyLabelsMatch(a: string, b: string): boolean {
  if (normalizeSupplierName(a) === normalizeSupplierName(b)) return true
  return semanticMatchScore(a, b).score >= 0.75
}

/** True when any label matches the contract-form property name (from filename). */
export function matchesContractFormProperty(
  contractFormPropertyTerm: string,
  labels: string[],
): boolean {
  const term = contractFormPropertyTerm.trim()
  if (!term) return true

  const normalizedLabels = labels.map((label) => label.trim()).filter(Boolean)
  if (normalizedLabels.length === 0) return false

  return normalizedLabels.some((label) => propertyLabelsMatch(term, label))
}

export function mappingMatchesContractForm(
  mapping: SupplierMapping,
  contractFormPropertyTerm: string,
): boolean {
  const term = contractFormPropertyTerm.trim()
  if (!term) return true

  const labels = new Set<string>()
  if (mapping.detected?.extractedName) labels.add(mapping.detected.extractedName)
  for (const property of mapping.detected?.properties ?? []) labels.add(property)
  if (mapping.peSupplier?.name) labels.add(mapping.peSupplier.name)
  if (mapping.peSupplier?.code) labels.add(mapping.peSupplier.code)

  return matchesContractFormProperty(term, [...labels])
}

/**
 * Drop singleton detections that duplicate a property already listed under a collection
 * group (e.g. contract-form anchor "Elewana Tortilis Camp Amboseli" when Collection
 * already includes Tortilis Camp Amboseli).
 */
export function consolidateDetectedSuppliers(detected: DetectedSupplier[]): DetectedSupplier[] {
  const normalized = normalizeDetectedSuppliers(detected)
  const collectionGroups = normalized.filter(
    (det) => isGroupDetection(det) && GROUP_NAME_PATTERN.test(det.extractedName),
  )
  const collectionProperties = collectionGroups.flatMap((g) => g.properties)
  const otherGroupProperties = normalized
    .filter((det) => isGroupDetection(det) && !GROUP_NAME_PATTERN.test(det.extractedName))
    .flatMap((g) => g.properties)
  const knownProperties = [...collectionProperties, ...otherGroupProperties]

  if (knownProperties.length === 0) return normalized

  return normalized.filter((det) => {
    if (isGroupDetection(det)) return true
    const labels = allPropertyLabelsInDetection(det)
    const isDuplicate = labels.some((label) =>
      knownProperties.some((prop) => propertyLabelsMatch(label, prop)),
    )
    return !isDuplicate
  })
}

function findBestPeForProperty(
  matchLabels: string[],
  peCatalog: Supplier[],
  usedPeIds: Set<number>,
): { pe: Supplier | null; confidence: DetectionConfidence; score: number } {
  let best: { pe: Supplier; confidence: DetectionConfidence; score: number } | null = null

  for (const pe of peCatalog) {
    if (usedPeIds.has(pe.supplier_id)) continue
    const match = bestPeMatchForLabels(matchLabels, pe)
    if (match.score >= MATCH_THRESHOLD && (!best || match.score > best.score)) {
      best = { pe, confidence: match.confidence, score: match.score }
    }
  }

  return best ?? { pe: null, confidence: 'low', score: 0 }
}

function rowsForDetection(
  det: DetectedSupplier,
): Array<{ label: string; matchLabels: string[] }> {
  const isGroup = det.properties.length > 1 || GROUP_NAME_PATTERN.test(det.extractedName)

  if (isGroup) {
    return det.properties.map((property) => ({
      label: property,
      matchLabels: [property],
    }))
  }

  const matchLabels = [...new Set([det.extractedName, ...det.properties].filter(Boolean))]
  return [{ label: det.extractedName, matchLabels }]
}

/** Build parent-grouped property rows with per-property semantic PE matches. */
export function buildMappingGroups(
  detected: DetectedSupplier[],
  peCatalog: Supplier[],
  contractFormPropertyTerm = '',
): { groups: PropertyMappingGroup[]; unmatchedPe: Supplier[] } {
  const normalized = consolidateDetectedSuppliers(detected)
  const usedPeIds = new Set<number>()
  const groups: PropertyMappingGroup[] = []

  for (const det of normalized) {
    const propertyRows = rowsForDetection(det)
    const mappings: SupplierMapping[] = []

    for (const row of propertyRows) {
      const { pe, confidence } = findBestPeForProperty(row.matchLabels, peCatalog, usedPeIds)
      if (pe) usedPeIds.add(pe.supplier_id)

      const contractFormMatch = matchesContractFormProperty(contractFormPropertyTerm, row.matchLabels)
      const autoInclude = pe != null && confidence !== 'low' && contractFormMatch

      mappings.push({
        peSupplier: pe,
        detected: {
          extractedName: row.label,
          properties: row.matchLabels.filter((label) => label !== row.label),
          confidence: det.confidence,
          sectionHint: det.sectionHint,
        },
        matchStatus: pe ? 'matched' : 'unmatched_pdf',
        confidence: pe ? confidence : 'low',
        contractFormMatch,
        included: autoInclude,
        isPrimary: false,
      })
    }

    groups.push({
      id: normalizeSupplierName(det.extractedName),
      parentName: det.extractedName,
      parentConfidence: det.confidence,
      mappings,
    })
  }

  const unmatchedPe = peCatalog.filter((pe) => !usedPeIds.has(pe.supplier_id))
  return { groups, unmatchedPe }
}

export function flattenMappingGroups(groups: PropertyMappingGroup[]): SupplierMapping[] {
  return groups.flatMap((group) => group.mappings)
}

/** Split group-level detections into one row per property for semantic matching. */
export function expandDetectedSuppliers(detected: DetectedSupplier[]): DetectedSupplier[] {
  const expanded: DetectedSupplier[] = []

  for (const det of detected) {
    if (!isGroupDetection(det)) {
      expanded.push({
        ...det,
        properties: det.properties.length ? det.properties : [det.extractedName],
      })
      continue
    }

    for (const property of det.properties) {
      const trimmed = property.trim()
      if (!trimmed) continue
      expanded.push({
        extractedName: trimmed,
        properties: [trimmed],
        confidence: det.confidence === 'high' ? 'medium' : det.confidence,
        sectionHint: det.sectionHint,
      })
    }

    if (det.properties.length === 0 && !GROUP_NAME_PATTERN.test(det.extractedName)) {
      expanded.push(det)
    }
  }

  const seen = new Set<string>()
  return expanded.filter((det) => {
    const key = normalizeSupplierName(det.extractedName)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function matchDetectedToCatalog(
  detected: DetectedSupplier[],
  peCatalog: Supplier[],
  contractFormPropertyTerm = '',
): SupplierMapping[] {
  const { groups, unmatchedPe } = buildMappingGroups(detected, peCatalog, contractFormPropertyTerm)
  const mappings = flattenMappingGroups(groups)

  for (const pe of unmatchedPe) {
    mappings.push({
      peSupplier: pe,
      detected: null,
      matchStatus: 'unmatched_pe',
      confidence: 'low',
      contractFormMatch: false,
      included: false,
      isPrimary: false,
    })
  }

  return mappings
}

/** Rank PE catalog for a mapping row — best semantic matches first (for dropdown). */
export function rankPeCatalogForDetection(
  detected: DetectedSupplier | null,
  peCatalog: Supplier[],
): Supplier[] {
  if (!detected) return [...peCatalog].sort((a, b) => a.name.localeCompare(b.name))

  const labels = detectionLabels(detected)
  return [...peCatalog].sort((a, b) => {
    const scoreA = bestPeMatchForLabels(labels, a).score
    const scoreB = bestPeMatchForLabels(labels, b).score
    if (scoreB !== scoreA) return scoreB - scoreA
    return a.name.localeCompare(b.name)
  })
}

export function shouldFastPathMapping(
  peCatalog: Supplier[],
  detected: DetectedSupplier[],
): boolean {
  const expanded = expandDetectedSuppliers(detected)
  return peCatalog.length === 1 && expanded.length === 1
}

export function buildFastPathMappings(
  peCatalog: Supplier[],
  detected: DetectedSupplier[],
): SupplierMapping[] {
  const expanded = expandDetectedSuppliers(detected)
  const pe = peCatalog[0]!
  const det = expanded[0]!
  return [
    {
      peSupplier: pe,
      detected: det,
      matchStatus: 'matched',
      confidence: 'high',
      contractFormMatch: true,
      included: true,
      isPrimary: true,
    },
  ]
}

export function finalizeMappings(mappings: SupplierMapping[]): SupplierMapping[] {
  return mappings
}

/** Included mappings in display order (group order, then property order). */
export function includedMappingsInOrder(mappings: SupplierMapping[]): SupplierMapping[] {
  return mappings.filter((m) => m.included && m.peSupplier)
}
