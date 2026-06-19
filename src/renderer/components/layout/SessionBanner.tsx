import { Badge } from '@/components/ui/badge'
import { STEP_LABELS } from '@shared/constants'
import type { ParseSession, Supplier } from '@shared/types'
import { statusLabel } from '../../lib/parseFlow'

interface Props {
  supplier: Supplier | null
  step: ParseSession['step']
  status: ParseSession['status']
  queuePosition?: { current: number; total: number } | null
}

export function SessionBanner({ supplier, step, status, queuePosition }: Props) {
  if (!supplier || step < 2) return null

  return (
    <div
      className="sticky top-0 z-10 px-0 py-2.5 mb-4 bg-accent/40 border-b border-accent/60 backdrop-blur-sm rounded-md"
      role="region"
      aria-label="Current session"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {queuePosition && (
          <Badge variant="outline" className="text-[10px] font-medium">
            Property {queuePosition.current} of {queuePosition.total}
          </Badge>
        )}
        <span className="font-heading font-semibold text-foreground">{supplier.name}</span>
        <span className="text-muted-foreground font-mono text-xs">{supplier.code}</span>
        <span className="text-muted-foreground text-xs">{supplier.destination_country}</span>
        <span className="hidden sm:inline text-muted-foreground">·</span>
        <span className="text-xs text-muted-foreground">
          Step {step}: {STEP_LABELS[step]}
        </span>
        <Badge
          variant={status === 'blocked' ? 'destructive' : status === 'complete' ? 'secondary' : 'outline'}
          className="text-[10px] ml-auto"
        >
          {statusLabel(status)}
        </Badge>
      </div>
    </div>
  )
}
