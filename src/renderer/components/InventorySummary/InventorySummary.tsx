import type { ServiceInventoryCounts } from '@shared/types'

interface Props {
  counts: ServiceInventoryCounts
  supplierName: string
  headOffice?: string
  destinationCountry?: string
}

export function InventorySummary({ counts, supplierName, headOffice, destinationCountry }: Props) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
      <p className="font-medium text-foreground mb-1">{supplierName}</p>
      {(destinationCountry || headOffice) && (
        <p className="text-muted-foreground text-xs mb-2">
          {[destinationCountry, headOffice ? `parent: ${headOffice}` : null].filter(Boolean).join(' — ')}
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        PE in-use services:{' '}
        <span className="text-foreground font-medium">{counts.accommodation}</span> Accommodation ·{' '}
        <span className="text-foreground font-medium">{counts.nonAccommodation}</span> Non-Accommodation ·{' '}
        <span className="text-foreground font-medium">{counts.extras}</span> Extras
      </p>
    </div>
  )
}
