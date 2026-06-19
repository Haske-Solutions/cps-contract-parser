import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle, Building2, CheckCircle2, type LucideIcon } from 'lucide-react'
import type { Supplier } from '@shared/types'

interface Props {
  candidates: Supplier[]
  onSelect: (supplier: Supplier) => void
  onNotFound: () => void
}

export function SupplierLookup({ candidates, onSelect, onNotFound }: Props) {
  if (candidates.length === 0) {
    return (
      <div className="flex flex-col gap-4" role="alert" aria-live="assertive">
        <StatusCallout
          variant="destructive"
          icon={AlertCircle}
          title="Supplier not found in Pink Elephant"
          description="Create the supplier in PE before proceeding. No further action is permitted until the supplier exists in the warehouse."
        />
        <Button variant="outline" onClick={onNotFound} className="self-start">
          Start over
        </Button>
      </div>
    )
  }

  if (candidates.length === 1) {
    const supplier = candidates[0]
    return (
      <div className="flex flex-col gap-4">
        <StatusCallout
          variant="success"
          icon={CheckCircle2}
          title="Supplier found"
          description="One match in Pink Elephant — confirm to continue with extraction."
        />
        <SupplierCard supplier={supplier} onSelect={() => onSelect(supplier)} label="Confirm" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <StatusCallout
        variant="info"
        icon={AlertCircle}
        title={`${candidates.length} matches found`}
        description="Select the Pink Elephant supplier that matches the uploaded documents."
      />
      <div
        className="flex max-h-[min(50vh,380px)] flex-col gap-3 overflow-y-auto pr-0.5"
        role="list"
        aria-label="Supplier candidates"
      >
        {candidates.map((supplier) => (
          <SupplierCard
            key={supplier.supplier_id}
            supplier={supplier}
            onSelect={() => onSelect(supplier)}
            label="Select"
          />
        ))}
      </div>
    </div>
  )
}

function StatusCallout({
  variant,
  icon: Icon,
  title,
  description,
}: {
  variant: 'info' | 'success' | 'destructive'
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div
      className={cn(
        'flex gap-3 rounded-lg border px-4 py-3',
        variant === 'info' && 'border-accent/60 bg-accent/20',
        variant === 'success' && 'border-emerald-200/80 bg-emerald-50/90',
        variant === 'destructive' && 'border-destructive/25 bg-destructive/5',
      )}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          variant === 'info' && 'text-primary',
          variant === 'success' && 'text-emerald-700',
          variant === 'destructive' && 'text-destructive',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold leading-none text-foreground">{title}</p>
        <p className="text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

interface CardProps {
  supplier: Supplier
  onSelect: () => void
  label: string
}

function SupplierCard({ supplier, onSelect, label }: CardProps) {
  return (
    <article
      role="listitem"
      className="group rounded-lg border border-border bg-card transition-[border-color,box-shadow] hover:border-primary/25 hover:shadow-sm"
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15"
          aria-hidden="true"
        >
          <Building2 className="size-4" strokeWidth={1.75} />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="font-heading text-[15px] font-semibold leading-snug text-foreground">
            {supplier.name}
          </h3>
        </div>

        <Button
          size="sm"
          className="shrink-0"
          onClick={onSelect}
          aria-label={`${label} ${supplier.name}`}
        >
          {label}
        </Button>
      </div>

      <div className="mx-4 mb-4 grid grid-cols-3 divide-x divide-border/80 overflow-hidden rounded-md border border-border/60 bg-muted/30">
        <MetaCell label="PE ID" value={String(supplier.supplier_id)} mono />
        <MetaCell label="Code" value={supplier.code} mono />
        <MetaCell label="Country" value={supplier.destination_country} />
      </div>
    </article>
  )
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate text-sm text-foreground',
          mono && 'font-mono text-xs tracking-tight',
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
