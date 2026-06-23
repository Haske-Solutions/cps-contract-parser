import type { ExtrasRow } from '../../shared/types'

const INFANT_RE = /infant/i
const CHILD_RE = /child/i
const ADULT_RE = /adult/i

function baseExtraName(name: string): string {
  return name
    .replace(/\s*(Adult|Child|Infant)(\s*\([^)]+\))?$/i, '')
    .replace(/\s*Sharing with \d+ Adults?$/i, '')
    .replace(/\s*Sharing$/i, '')
    .trim()
}

function rowKindOrder(row: ExtrasRow): number {
  if (row.infantOnly || INFANT_RE.test(row.extraName)) return 0
  if (ADULT_RE.test(row.extraName) && !CHILD_RE.test(row.extraName)) return 1
  if (row.childOnly || CHILD_RE.test(row.extraName)) return 2
  return 1
}

export function sortExtrasRows(rows: ExtrasRow[]): ExtrasRow[] {
  return [...rows].sort((a, b) => {
    const parentCmp = a.parentServiceName.localeCompare(b.parentServiceName)
    if (parentCmp !== 0) return parentCmp

    const itemA = baseExtraName(a.extraName)
    const itemB = baseExtraName(b.extraName)
    const itemCmp = itemA.localeCompare(itemB)
    if (itemCmp !== 0) return itemCmp

    const kindCmp = rowKindOrder(a) - rowKindOrder(b)
    if (kindCmp !== 0) return kindCmp

    return a.dateFrom.localeCompare(b.dateFrom)
  })
}

export function consolidateFlatExtras(rows: ExtrasRow[]): ExtrasRow[] {
  const key = (r: ExtrasRow) =>
    `${r.parentServiceId}|${r.extraName}|${r.cost}|${r.sell}|${r.pricePercent}|${r.rateCode}`

  const groups = new Map<string, ExtrasRow[]>()
  for (const row of rows) {
    if (row.pricePercent != null) {
      const k = key(row)
      const list = groups.get(k) ?? []
      list.push(row)
      groups.set(k, list)
      continue
    }
    const k = key(row)
    const list = groups.get(k) ?? []
    list.push(row)
    groups.set(k, list)
  }

  const out: ExtrasRow[] = []
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0])
      continue
    }
    const sorted = [...group].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    if (
      first.cost === last.cost &&
      first.sell === last.sell &&
      (first.pricePercent ?? null) === (last.pricePercent ?? null)
    ) {
      out.push({
        ...first,
        dateFrom: first.dateFrom,
        dateTo: last.dateTo,
      })
    } else {
      out.push(...group)
    }
  }
  return out
}
