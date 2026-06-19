/** Derive a warehouse supplier search term from an uploaded PDF filename. */
export function deriveSupplierSearchTerm(filename: string): string {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/^CPS\s+/i, '')
    .replace(/\s+(Accommodation\s+)?Contract\s+Form.*$/i, '')
    .replace(/\s+(Rack\s*&\s*Net\s+)?Rates.*$/i, '')
    .replace(/\s+\d{4}(\s+(KE|TZ))?(\s*&\s*TZ)?.*$/i, '')
    .trim()
}

/** Prefer contract-form naming; fall back to rate sheet when needed. */
export function supplierSearchTermsFromFilenames(
  contractFormFilename: string,
  rateSheetFilename: string,
): string[] {
  const terms = [
    deriveSupplierSearchTerm(contractFormFilename),
    deriveSupplierSearchTerm(rateSheetFilename),
  ].filter((term) => term.length > 0)

  return [...new Set(terms)]
}

function commonWordPrefix(terms: string[]): string {
  if (terms.length < 2) return ''

  const wordLists = terms.map((term) =>
    term
      .trim()
      .split(/\s+/)
      .filter(Boolean),
  )
  const prefix: string[] = []

  for (let i = 0; i < wordLists[0]!.length; i++) {
    const word = wordLists[0]![i]!.toLowerCase()
    if (wordLists.every((words) => words[i]?.toLowerCase() === word)) {
      prefix.push(wordLists[0]![i]!)
    } else {
      break
    }
  }

  return prefix.join(' ')
}

function leadingBrandToken(term: string): string | null {
  const first = term.trim().split(/\s+/)[0]
  return first && first.length >= 2 ? first : null
}

function groupBrandFromTerm(term: string): string | null {
  const match = term.match(
    /^(.+?)\s+(?:Collection|Group|Safaris|Lodges|Camps|Portfolio|Hotels)(?:\b|$)/i,
  )
  return match?.[1]?.trim() || null
}

function propertyBrandFromTerm(term: string): string | null {
  const match = term.match(
    /^(.+?)\s+(?:Camp|Lodge|Hotel|Resort|Tented|Treetops|House|Villa|Manor)\b/i,
  )
  if (!match) return null
  const brand = match[1]!.trim()
  const words = brand.split(/\s+/)
  return words.length > 2 ? words.slice(0, 2).join(' ') : brand
}

/** Collect brand-level anchor candidates from filename-derived terms (broadest first). */
export function catalogAnchorTermsFromFilenames(
  contractFormFilename: string,
  rateSheetFilename: string,
): string[] {
  const terms = supplierSearchTermsFromFilenames(contractFormFilename, rateSheetFilename)
  const anchors = new Set<string>()

  const add = (value: string | null | undefined): void => {
    const trimmed = value?.trim()
    if (trimmed && trimmed.length >= 2) anchors.add(trimmed)
  }

  add(commonWordPrefix(terms))

  for (const term of terms) {
    add(leadingBrandToken(term))
    add(groupBrandFromTerm(term))
    add(propertyBrandFromTerm(term))
  }

  if (anchors.size === 0) add(leadingBrandToken(terms[0] ?? ''))

  return [...anchors].sort((a, b) => a.length - b.length || a.localeCompare(b))
}

/** Primary brand anchor for PE accommodation catalog lookup (shortest/broadest candidate). */
export function anchorTermFromFilenames(
  contractFormFilename: string,
  rateSheetFilename: string,
): string {
  return catalogAnchorTermsFromFilenames(contractFormFilename, rateSheetFilename)[0] ?? ''
}
