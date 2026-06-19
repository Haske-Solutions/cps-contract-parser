export type WithGridId<T> = T & { __gridId: string }

export function withGridIds<T>(rows: T[], keyFn: (row: T, index: number) => string): WithGridId<T>[] {
  return rows.map((row, index) => ({
    ...row,
    __gridId: keyFn(row, index),
  }))
}

export function stripGridIds<T>(rows: WithGridId<T>[]): T[] {
  return rows.map(({ __gridId: _id, ...row }) => row as T)
}

export function rateRowGridId(row: {
  serviceId: number
  rateCode: string
  validFrom: string
  service: string
}, index: number): string {
  return `${row.serviceId}-${row.rateCode}-${row.validFrom}-${row.service}-${index}`
}

export function extractedRateGridId(
  row: { propertyName: string; roomType: string; seasonName: string; validFrom: string },
  index: number,
): string {
  return `${row.propertyName}-${row.roomType}-${row.seasonName}-${row.validFrom}-${index}`
}

export function serviceMatchGridId(row: { extractedName: string }, index: number): string {
  return `${row.extractedName}-${index}`
}

export function priorRateGridId(
  row: { serviceName: string; logTimestamp: string },
  index: number,
): string {
  return `${row.serviceName}-${row.logTimestamp}-${index}`
}
