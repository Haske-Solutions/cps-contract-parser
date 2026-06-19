import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { STEP_LABELS } from '@shared/constants'
import {
  Download,
  AlertCircle,
  Building2,
  CalendarClock,
  Flag,
  Table2,
  Layers,
  type LucideIcon,
} from 'lucide-react'
import type { ParseSession, ValidationFlag, ValidationSeverity } from '@shared/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: ParseSession | null
  loading: boolean
  error: string | null
  isDownloading: boolean
  onRedownload: (id: string, supplierCode: string) => void
  onDelete: (id: string) => void
  onRestore?: (session: ParseSession) => void
}

function statusLabel(status: ParseSession['status']): string {
  switch (status) {
    case 'complete':
      return 'Complete'
    case 'blocked':
      return 'Blocked'
    case 'loading':
      return 'Processing'
    case 'awaiting_supplier_selection':
      return 'Select supplier'
    case 'awaiting_confirmation':
      return 'Awaiting review'
    case 'awaiting_mismatch':
      return 'Mismatch review'
    default:
      return 'In progress'
  }
}

function statusBadgeVariant(
  status: ParseSession['status'],
): 'success' | 'destructive' | 'secondary' {
  if (status === 'complete') return 'success'
  if (status === 'blocked') return 'destructive'
  return 'secondary'
}

function displayStep(session: ParseSession): number {
  return session.status === 'complete' ? 6 : session.step
}

export function SessionDetailModal({
  open,
  onOpenChange,
  session,
  loading,
  error,
  isDownloading,
  onRedownload,
  onDelete,
  onRestore,
}: Props) {
  const supplierName = session?.supplier?.name ?? 'Unknown Supplier'
  const isComplete = session?.status === 'complete'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="gap-0 border-b border-border/80">
          {loading && (
            <div className="px-5 pr-12 py-6">
              <p className="text-sm text-muted-foreground">Loading session…</p>
            </div>
          )}
          {session && !loading && (
            <SessionHeader session={session} supplierName={supplierName} />
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto flex flex-col gap-5 px-5 py-4">
          {loading && (
            <div className="flex justify-center py-10">
              <Spinner className="size-8 text-primary" aria-hidden="true" />
              <span className="sr-only">Loading session details</span>
            </div>
          )}

          {error && !loading && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {session && !loading && !error && (
            <>
              {session.validationFlags.length > 0 && (
                <ValidationFlagsTable flags={session.validationFlags} />
              )}

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Table2}
                  label="Rate rows"
                  value={session.outputRows.length}
                />
                <StatCard
                  icon={Layers}
                  label="Extras rows"
                  value={session.extrasRows.length}
                />
              </div>
            </>
          )}
        </div>

        {session && !loading && !error && (
          <DialogFooter className="!mx-0 !mb-0 flex-row flex-wrap gap-2 border-t border-border/80 bg-muted/20 px-5 py-4 sm:justify-end">
            {isComplete && (
              <Button
                size="sm"
                onClick={() => onRedownload(session.id, session.supplier?.code ?? 'export')}
                disabled={isDownloading}
              >
                <Download data-icon="inline-start" />
                {isDownloading ? 'Generating…' : 'Re-download Excel'}
              </Button>
            )}
            {onRestore && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onRestore(session)
                  onOpenChange(false)
                }}
              >
                Restore session
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                onDelete(session.id)
                onOpenChange(false)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  stop: 'Stop',
  needs_creation: 'Needs creation',
  rate_change: 'Rate change',
  info: 'Info',
}

function SessionHeader({
  session,
  supplierName,
}: {
  session: ParseSession
  supplierName: string
}) {
  const step = displayStep(session)
  const dateLabel = session.status === 'complete' ? 'Completion date' : 'Created'

  return (
    <div className="bg-accent/25 pl-5 pr-12 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start gap-3">
            <div
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 text-primary shadow-sm ring-1 ring-border/60"
              aria-hidden="true"
            >
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="sr-only">{supplierName} session</DialogTitle>
              <div className="space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Supplier
                  </p>
                  <p className="font-heading text-lg font-semibold leading-snug text-foreground mt-0.5">
                    {supplierName}
                  </p>
                </div>

                {session.supplier && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 border-l-2 border-primary/25 pl-3">
                    <MetaField label="ID" value={session.supplier.code} mono />
                    <MetaField label="Country" value={session.supplier.destination_country} />
                  </div>
                )}

                <DialogDescription className="flex items-center gap-2 text-sm">
                  <CalendarClock className="size-3.5 shrink-0 text-primary/80" aria-hidden="true" />
                  <span>
                    <span className="font-semibold text-foreground">{dateLabel}:</span>{' '}
                    {formatDate(session.createdAt)}
                  </span>
                </DialogDescription>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge variant={statusBadgeVariant(session.status)}>
            {statusLabel(session.status)}
          </Badge>
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            Step {step} · {STEP_LABELS[step]}
          </Badge>
        </div>
      </div>
    </div>
  )
}

function MetaField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-0.5 text-sm text-foreground', mono && 'font-mono text-xs')}>
        {value}
      </p>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary/70" aria-hidden="true" />
        {label}
      </div>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  )
}

function ValidationFlagsTable({ flags }: { flags: ValidationFlag[] }) {
  const headCellClass =
    'sticky top-0 z-20 h-10 px-3 text-left align-middle font-medium text-xs text-foreground bg-muted border-b border-border'
  const bodyCellClass = 'px-3 py-2.5 align-middle text-xs bg-inherit'

  return (
    <section aria-labelledby="validation-flags-heading">
      <div className="mb-3 flex items-center gap-2">
        <Flag className="size-4 text-primary/80" aria-hidden="true" />
        <h3 id="validation-flags-heading" className="text-sm font-heading font-semibold">
          Validation flags
        </h3>
        <Badge variant="secondary" className="tabular-nums">
          {flags.length}
        </Badge>
      </div>
      <div className="rounded-xl border border-border/80 overflow-hidden shadow-sm">
        <div className="max-h-64 overflow-auto">
          <table
            className="min-w-full w-max caption-bottom text-sm border-separate border-spacing-0"
            aria-label="Validation flags"
          >
            <thead className="bg-muted">
              <tr>
                <th className={cn(headCellClass, 'w-[100px]')}>Severity</th>
                <th className={cn(headCellClass, 'w-[72px]')}>Code</th>
                <th className={headCellClass}>Message</th>
                <th className={cn(headCellClass, 'w-[140px]')}>Service</th>
              </tr>
            </thead>
            <tbody>
              {flags.map((flag, i) => (
                <tr
                  key={i}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/50',
                    flag.severity === 'stop' && 'bg-stop',
                    flag.severity === 'needs_creation' && 'bg-needs_creation',
                    flag.severity === 'rate_change' && 'bg-rate_change',
                  )}
                >
                  <td className={bodyCellClass}>
                    <SeverityBadge severity={flag.severity} />
                  </td>
                  <td className={cn(bodyCellClass, 'font-mono whitespace-nowrap')}>{flag.code}</td>
                  <td className={cn(bodyCellClass, 'whitespace-nowrap')}>
                    <span>{flag.message}</span>
                    {flag.details && (
                      <p className="text-muted-foreground mt-0.5">{flag.details}</p>
                    )}
                  </td>
                  <td className={cn(bodyCellClass, 'text-muted-foreground whitespace-nowrap')}>
                    {flag.affectedService ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function SeverityBadge({ severity }: { severity: ValidationSeverity }) {
  const variant =
    severity === 'stop'
      ? 'destructive'
      : severity === 'needs_creation'
        ? 'secondary'
        : 'outline'

  return (
    <Badge variant={variant} className="text-[10px] whitespace-nowrap">
      {SEVERITY_LABELS[severity]}
    </Badge>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
