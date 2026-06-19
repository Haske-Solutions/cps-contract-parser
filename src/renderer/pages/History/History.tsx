import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { History as HistoryIcon, AlertCircle, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '../../components/layout/ConfirmDialog'
import { SessionDetailModal } from '../../components/History/SessionDetailModal'
import type { HistorySession, ParseSession } from '@shared/types'
import { toArrayBuffer } from '@shared/sessionUtils'

interface Props {
  onRestore?: (session: ParseSession) => void
}

export function History({ onRestore }: Props) {
  const [sessions, setSessions] = useState<HistorySession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<ParseSession | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    void loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.electronAPI.history.list()
      setSessions(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session history')
    } finally {
      setLoading(false)
    }
  }

  const handleRowClick = async (id: string) => {
    setModalOpen(true)
    setSelectedSession(null)
    setDetailError(null)
    setLoadingDetail(true)

    try {
      const session = await window.electronAPI.history.getSession(id)
      if (!session) {
        setDetailError('Session not found or could not be loaded.')
        return
      }
      setSelectedSession(session)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load session details')
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleModalOpenChange = (open: boolean) => {
    setModalOpen(open)
    if (!open) {
      setSelectedSession(null)
      setDetailError(null)
      setLoadingDetail(false)
    }
  }

  const handleRedownload = async (id: string, supplierCode: string) => {
    setDownloadingId(id)
    try {
      const session = await window.electronAPI.history.getSession(id)
      if (!session) {
        toast.error('Session not found')
        return
      }
      const result = await window.electronAPI.export.generateExcel(session)
      await window.electronAPI.file.saveExcel(
        toArrayBuffer(result.buffer),
        `CPS_${supplierCode}_rates.xlsx`,
      )
      toast.success('Excel file saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Re-download failed')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await window.electronAPI.history.deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (selectedSession?.id === id) {
        setSelectedSession(null)
        setModalOpen(false)
      }
      toast.success('Session deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleteTargetId(null)
    }
  }

  const handleClearAll = async () => {
    setClearing(true)
    try {
      await window.electronAPI.history.clearAll()
      setSessions([])
      setModalOpen(false)
      setSelectedSession(null)
      toast.success('Session history cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear history')
    } finally {
      setClearing(false)
      setShowClearDialog(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {sessions.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {sessions.length} saved session{sessions.length !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearDialog(true)}
            disabled={clearing}
            className="text-destructive hover:text-destructive shrink-0"
          >
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Clear all
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-8 text-primary" aria-hidden="true" />
          <span className="sr-only">Loading history…</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Could not load history</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            <Button size="sm" variant="outline" onClick={loadHistory}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-14 text-center">
          <div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted">
            <HistoryIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">No past sessions found</p>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-balance">
            Completed parse sessions appear here after you finish or save a run.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table aria-label="Session history">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs">Supplier</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs text-right">Flags</TableHead>
                <TableHead className="text-xs text-right">Excel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className="cursor-pointer hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                  tabIndex={0}
                  role="button"
                  aria-label={`View session for ${session.supplierName}`}
                  onClick={() => handleRowClick(session.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleRowClick(session.id)
                    }
                  }}
                >
                  <TableCell className="font-medium text-sm">{session.supplierName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(session.createdAt)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={session.status} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {session.validationFlagCount > 0 ? session.validationFlagCount : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {session.hasExcel ? 'Yes' : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <SessionDetailModal
        open={modalOpen}
        onOpenChange={handleModalOpenChange}
        session={selectedSession}
        loading={loadingDetail}
        error={detailError}
        isDownloading={selectedSession ? downloadingId === selectedSession.id : false}
        onRedownload={handleRedownload}
        onDelete={(id) => setDeleteTargetId(id)}
        onRestore={onRestore}
      />

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Delete session?"
        description="This will permanently delete the session log. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deleteTargetId && handleDelete(deleteTargetId)}
      />

      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Clear session history?"
        description="This will permanently delete all saved session logs. This cannot be undone."
        confirmLabel="Clear all"
        variant="destructive"
        onConfirm={handleClearAll}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: HistorySession['status'] }) {
  const config = {
    complete: { label: 'Complete', variant: 'success' as const, className: '' },
    blocked: { label: 'Blocked', variant: 'destructive' as const, className: '' },
    in_progress: {
      label: 'In progress',
      variant: 'outline' as const,
      className: 'border-accent text-accent-foreground',
    },
  }
  const { label, variant, className } = config[status]
  return (
    <Badge variant={variant} className={cn('text-[10px]', className)}>
      {label}
    </Badge>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
