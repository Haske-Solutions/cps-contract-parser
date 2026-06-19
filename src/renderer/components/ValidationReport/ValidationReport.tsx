import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { XCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ValidationFlag, ValidationSeverity } from '@shared/types'

interface Props {
  flags: ValidationFlag[]
}

const SEVERITY_CONFIG: Record<
  ValidationSeverity,
  {
    icon: typeof XCircle
    label: string
    badgeVariant: 'default' | 'destructive' | 'secondary' | 'outline'
    rowClass: string
  }
> = {
  stop: {
    icon: XCircle,
    label: 'STOP',
    badgeVariant: 'destructive',
    rowClass: 'border-destructive/50 bg-stop',
  },
  needs_creation: {
    icon: AlertTriangle,
    label: 'Needs Creation',
    badgeVariant: 'secondary',
    rowClass: 'border-border bg-needs_creation',
  },
  rate_change: {
    icon: AlertTriangle,
    label: 'Rate Change',
    badgeVariant: 'outline',
    rowClass: 'border-border bg-rate_change',
  },
  info: {
    icon: Info,
    label: 'Info',
    badgeVariant: 'secondary',
    rowClass: 'border-border bg-muted/30',
  },
}

const SEVERITY_ORDER: ValidationSeverity[] = ['stop', 'needs_creation', 'rate_change', 'info']

export function ValidationReport({ flags }: Props) {
  const [expanded, setExpanded] = useState<Record<ValidationSeverity, boolean>>({
    stop: true,
    needs_creation: true,
    rate_change: true,
    info: false,
  })

  if (flags.length === 0) {
    return null
  }

  const hasStop = flags.some((f) => f.severity === 'stop')

  return (
    <div className="flex flex-col gap-4" aria-label="Validation report">
      {hasStop && (
        <div className="flex justify-end">
          <Badge variant="destructive">Export blocked</Badge>
        </div>
      )}

      {SEVERITY_ORDER.map((severity) => {
        const group = flags.filter((f) => f.severity === severity)
        if (group.length === 0) return null
        const cfg = SEVERITY_CONFIG[severity]
        const Icon = cfg.icon
        const isOpen = expanded[severity]

        return (
          <div key={severity} className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 hover:bg-muted/60 text-left"
              onClick={() => setExpanded((prev) => ({ ...prev, [severity]: !prev[severity] }))}
              aria-expanded={isOpen}
            >
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                {isOpen ? (
                  <ChevronDown className="size-3.5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-3.5" aria-hidden="true" />
                )}
                {cfg.label} ({group.length})
              </span>
            </button>

            {isOpen && (
              <div className="flex flex-col gap-1.5 p-2" role="list">
                {group.map((flag, i) => (
                  <div
                    key={i}
                    role="listitem"
                    className={cn('rounded-md border px-3 py-2 flex flex-col gap-0.5', cfg.rowClass)}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" aria-hidden="true" />
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={cfg.badgeVariant} className="text-[10px] font-mono">
                          {flag.code}
                        </Badge>
                        <p className="text-xs text-foreground">{flag.message}</p>
                      </div>
                    </div>
                    {flag.affectedService && (
                      <p className="text-[11px] text-muted-foreground pl-5">
                        Service: <span className="font-medium text-foreground">{flag.affectedService}</span>
                      </p>
                    )}
                    {flag.details && (
                      <p className="text-[11px] text-muted-foreground pl-5">{flag.details}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
