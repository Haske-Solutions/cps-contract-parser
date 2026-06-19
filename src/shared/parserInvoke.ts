import type { Supplier } from './types'

export interface ExtractRatesOptions {
  peCatalog?: Supplier[]
  targetPeSupplierId?: number
  /** PDF section label from discovery — helps targeted extraction find the right lodge/camp. */
  targetPropertyLabel?: string
}

export interface DiscoverProxyRequest {
  ratePDF: string
  contractForm: string
  peCatalog: Supplier[]
  anchorTerm: string
}

export interface ExtractProxyRequest {
  ratePDF: string
  contractForm: string
  options?: ExtractRatesOptions
}

export function uint8ArrayToBase64(arr: Uint8Array): string {
  return Buffer.from(arr).toString('base64')
}

export function base64ToUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'))
}

export function decodePdfPayload(value: string | Uint8Array, label: string): Uint8Array {
  if (value instanceof Uint8Array) {
    if (!value.length) throw new Error(`${label} is empty.`)
    return value
  }
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is empty.`)
  return base64ToUint8Array(trimmed)
}

/** Strip markdown fences and parse Claude text output. */
export function parseClaudeResponseText(text: string, stopReason?: string): unknown {
  const candidates = collectJsonCandidates(text)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // try next extraction strategy
    }
  }

  if (stopReason === 'max_tokens') {
    throw new Error(
      'The AI response was truncated before extraction finished. Retry extraction, or split very large PDFs into smaller documents.',
    )
  }

  throw new Error(
    'The AI returned a response that could not be parsed as JSON. Please try extraction again.',
  )
}

function collectJsonCandidates(text: string): string[] {
  const seen = new Set<string>()
  const candidates: string[] = []

  const add = (value: string | null | undefined): void => {
    const trimmed = value?.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    candidates.push(trimmed)
  }

  add(text)

  const wholeFence = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i)
  add(wholeFence?.[1])

  for (const match of text.matchAll(/```(?:json)?\s*\n?([\s\S]*?)\n?```/gi)) {
    add(match[1])
  }

  add(extractBalancedJsonObject(text))

  return candidates
}

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start < 0) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (ch === '\\' && inString) {
      escaped = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') depth++
    if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}

export function pdfDocumentBlocks(ratePDF: Uint8Array, contractForm: Uint8Array) {
  return [
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: uint8ArrayToBase64(ratePDF),
      },
      title: 'Supplier Rate Sheet',
    },
    {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: uint8ArrayToBase64(contractForm),
      },
      title: 'CPS Contract Form (authoritative)',
    },
  ]
}

export function buildPeCatalogContext(peCatalog: Supplier[]): string {
  const entries = peCatalog.map((s) => ({
    id: s.supplier_id,
    name: s.name,
    code: s.code,
    country: s.destination_country,
  }))
  return JSON.stringify(entries, null, 2)
}

export function buildExtractionUserText(options?: ExtractRatesOptions): string {
  const parts: string[] = []

  if (options?.peCatalog?.length) {
    parts.push(
      'peAccommodationSuppliers reference list (assign peSupplierId and peSupplierCode from this list when matched):',
      buildPeCatalogContext(options.peCatalog),
    )
  }

  if (options?.targetPeSupplierId) {
    const focus =
      options.targetPropertyLabel?.trim()
        ? ` Focus on the contract section for "${options.targetPropertyLabel.trim()}".`
        : ''
    parts.push(
      `targetPeSupplierId: ${options.targetPeSupplierId}`,
      `Extract ONLY the contract for this PE supplier.${focus} Return a single suppliers[] entry.`,
    )
  } else {
    parts.push(
      'Extract all rates and policies for every supplier in the documents. Process sequentially — every lodge/camp section must be reviewed.',
    )
  }

  parts.push('Return JSON only.')
  return parts.join('\n\n')
}

export function buildDiscoveryUserText(peCatalog: Supplier[], anchorTerm: string): string {
  return [
    `anchorTerm: ${anchorTerm}`,
    'peAccommodationSuppliers reference list:',
    buildPeCatalogContext(peCatalog),
    'List every distinct accommodation supplier/property section in the documents. Return JSON only.',
  ].join('\n\n')
}

export function assertPdfPair(ratePDF: Uint8Array, contractForm: Uint8Array): void {
  if (!ratePDF?.length || !contractForm?.length) {
    throw new Error(
      'Both PDF documents are required before extraction can begin (Precondition P1).',
    )
  }
}
