export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '—'
  return String(value)
}

export function parseBooleanInput(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === 'yes' || normalized === 'true' || normalized === '1'
}

export function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : fallback
}
