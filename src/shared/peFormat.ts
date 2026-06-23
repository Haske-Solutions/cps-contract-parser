/** PE import formatting helpers (v5.6). */

export function formatPeDate(iso: string): string {
  if (!iso) return ''
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return iso
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function formatPeBool(value: boolean): 'TRUE' | 'FALSE' {
  return value ? 'TRUE' : 'FALSE'
}

export function parsePeNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const s = String(value).replace(/[$,\s]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export function normalizeAmountForCompare(value: string | number): number | null {
  return parsePeNumeric(value)
}
