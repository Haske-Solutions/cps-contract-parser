import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExtractionResult, ExtractedPolicy, ExtractedRate } from '@shared/types'
import { POLICY_TYPE_LABELS } from '@shared/constants'
import { EditableDataGrid } from '@/lib/dataGrid/EditableDataGrid'
import { buildExtractedRateColumns } from '@/lib/dataGrid/columnBuilders'
import { coerceExtractedRate } from '@/lib/dataGrid/coerceRowValues'
import { createEmptyExtractedRate } from '@/lib/dataGrid/rowFactories'
import { extractedRateGridId } from '@/lib/dataGrid/types'
import { ConfirmDialog } from '@/components/layout/ConfirmDialog'

interface Props {
  extraction: ExtractionResult
  onConfirm: (policies: ExtractedPolicy[], rates: ExtractedRate[]) => void
  preConfirmed?: boolean
}

function policiesByType(policies: ExtractedPolicy[]): Record<string, ExtractedPolicy> {
  return Object.fromEntries(policies.map((p) => [p.type, p]))
}

export function PolicyReview({ extraction, onConfirm, preConfirmed = false }: Props) {
  const [acknowledged, setAcknowledged] = useState(false)
  const [policies, setPolicies] = useState<Record<string, ExtractedPolicy>>(() =>
    policiesByType(extraction.policies),
  )
  const [savedByType, setSavedByType] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(extraction.policies.map((p) => [p.type, true])),
  )
  const [expandedPolicies, setExpandedPolicies] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(extraction.policies.map((p) => [p.type, true])),
  )
  const [editingType, setEditingType] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ExtractedPolicy | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [ratesDraft, setRatesDraft] = useState<ExtractedRate[]>(() => [...extraction.rates])
  const extractedRateColumns = useMemo(() => buildExtractedRateColumns(), [])

  const extractedRateSeed = useMemo(() => {
    const template = extraction.rates[0]
    return {
      propertyName: extraction.properties[0] ?? template?.propertyName ?? '',
      validFrom: extraction.contractPeriod.from,
      validTo: extraction.contractPeriod.to,
      currency: template?.currency ?? 'USD',
      mealBasis: template?.mealBasis ?? 'Full Board',
      rateCode: template?.rateCode ?? 'DBL',
    }
  }, [extraction])

  const createEmptyRow = useCallback(
    () => createEmptyExtractedRate(extractedRateSeed),
    [extractedRateSeed],
  )

  useEffect(() => {
    setRatesDraft([...extraction.rates])
  }, [extraction.rates])

  const hasNoPolicies = extraction.policies.length === 0

  const unsavedPolicyLabel =
    editingType !== null ? (POLICY_TYPE_LABELS[editingType] ?? editingType) : ''

  const toggleExpanded = (type: string) =>
    setExpandedPolicies((prev) => ({ ...prev, [type]: !prev[type] }))

  const startEditing = useCallback(
    (type: string) => {
      const policy = policies[type]
      if (!policy) return
      setEditingType(type)
      setEditDraft({ ...policy })
      setSavedByType((prev) => ({ ...prev, [type]: false }))
      setExpandedPolicies((prev) => ({ ...prev, [type]: true }))
    },
    [policies],
  )

  const cancelEditing = useCallback(() => {
    if (editingType) {
      setSavedByType((prev) => ({ ...prev, [editingType]: true }))
    }
    setEditingType(null)
    setEditDraft(null)
  }, [editingType])

  const savePolicy = useCallback(() => {
    if (!editingType || !editDraft) return
    if (!editDraft.verbatimText.trim() || !editDraft.interpretation.trim()) return

    setPolicies((prev) => ({ ...prev, [editingType]: { ...editDraft, confirmed: true } }))
    setSavedByType((prev) => ({ ...prev, [editingType]: true }))
    setEditingType(null)
    setEditDraft(null)
  }, [editingType, editDraft])

  const proceedToStep3 = useCallback(() => {
    const savedPolicies = extraction.policies.map((p) => policies[p.type] ?? p)
    setEditingType(null)
    setEditDraft(null)
    onConfirm(savedPolicies, ratesDraft)
  }, [extraction.policies, policies, ratesDraft, onConfirm])

  const handleContinue = () => {
    if (editingType !== null) {
      setShowUnsavedDialog(true)
      return
    }
    proceedToStep3()
  }

  const handleContinueWithoutSaving = () => {
    if (editingType) {
      setSavedByType((prev) => ({ ...prev, [editingType]: true }))
    }
    setShowUnsavedDialog(false)
    proceedToStep3()
  }

  const updateDraftField = <K extends keyof ExtractedPolicy>(field: K, value: ExtractedPolicy[K]) => {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Extraction Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Supplier</p>
              <p className="font-medium">{extraction.supplierName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Contract Period</p>
              <p className="font-medium">
                {extraction.contractPeriod.from} — {extraction.contractPeriod.to}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Properties</p>
              <p className="font-medium">{extraction.properties.join(', ') || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-semibold">
            Extracted Rates{' '}
            <Badge variant="secondary">{ratesDraft.length}</Badge>
          </h3>
          {!preConfirmed && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Select rows with checkboxes to delete in bulk. Click a cell to edit. Changes are saved
              when you continue to Step 3.
            </p>
          )}
        </div>
        <Card className="overflow-hidden">
          {preConfirmed && ratesDraft.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No rates extracted
            </p>
          ) : (
            <EditableDataGrid
              columns={extractedRateColumns}
              rows={ratesDraft}
              rowKeyFn={extractedRateGridId}
              onRowsChange={preConfirmed ? undefined : setRatesDraft}
              createEmptyRow={preConfirmed ? undefined : createEmptyRow}
              readOnly={preConfirmed}
              coerceRow={coerceExtractedRate}
              height={420}
              ariaLabel="Extracted rate rows"
            />
          )}
        </Card>
      </div>

      <Separator />

      <div className="flex flex-col gap-3 min-w-0">
        <h3 className="text-sm font-semibold">Extracted Policies</h3>

        {hasNoPolicies ? (
          <div className="flex flex-col gap-3">
            <Alert>
              <AlertTriangle className="size-4" />
              <AlertTitle>No child policy found</AlertTitle>
              <AlertDescription>
                CIOR services will not be loaded for this session.
              </AlertDescription>
            </Alert>
            <Label className="flex items-center gap-2 cursor-pointer font-normal">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(checked === true)}
              />
              I acknowledge that no child policy was found and CIOR services will be skipped
            </Label>
            <Button
              disabled={!acknowledged}
              onClick={() => onConfirm([], ratesDraft)}
              variant="outline"
              className="self-start"
            >
              Acknowledge &amp; Continue
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {extraction.policies.map((policy) => {
              const type = policy.type
              const saved = savedByType[type] ?? false
              const isEditing = editingType === type
              const displayPolicy = policies[type] ?? policy

              return (
                <PolicyCard
                  key={type}
                  policy={displayPolicy}
                  expanded={expandedPolicies[type] ?? true}
                  saved={saved}
                  isEditing={isEditing}
                  editDraft={isEditing ? editDraft : null}
                  onToggleExpand={() => toggleExpanded(type)}
                  onEdit={() => startEditing(type)}
                  onSave={savePolicy}
                  onCancel={cancelEditing}
                  onDraftChange={updateDraftField}
                  readOnly={preConfirmed}
                />
              )
            })}

            {!preConfirmed ? (
              <>
                <Button onClick={handleContinue} className="self-start">
                  Continue to Step 3
                </Button>
                <ConfirmDialog
                  open={showUnsavedDialog}
                  onOpenChange={setShowUnsavedDialog}
                  title="Unsaved policy changes"
                  description={`${unsavedPolicyLabel} has unsaved edits. Save the section first, or continue without saving — your changes will be discarded.`}
                  confirmLabel="Continue without saving"
                  cancelLabel="Go back"
                  onConfirm={handleContinueWithoutSaving}
                />
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Policies pre-confirmed from session notes
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PolicyCard({
  policy,
  expanded,
  saved,
  isEditing,
  editDraft,
  onToggleExpand,
  onEdit,
  onSave,
  onCancel,
  onDraftChange,
  readOnly,
}: {
  policy: ExtractedPolicy
  expanded: boolean
  saved: boolean
  isEditing: boolean
  editDraft: ExtractedPolicy | null
  onToggleExpand: () => void
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
  onDraftChange: <K extends keyof ExtractedPolicy>(field: K, value: ExtractedPolicy[K]) => void
  readOnly?: boolean
}) {
  const label = POLICY_TYPE_LABELS[policy.type] ?? policy.type
  const canSave =
    isEditing &&
    editDraft &&
    editDraft.verbatimText.trim().length > 0 &&
    editDraft.interpretation.trim().length > 0

  return (
    <Card
      className={cn(
        'min-w-0 overflow-hidden',
        saved && !isEditing && 'border-emerald-200/80',
      )}
    >
      <CardHeader className={cn('px-4', expanded ? 'pt-4 pb-2' : 'py-4')}>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 py-0.5 text-left"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <CardTitle className="text-sm">{label}</CardTitle>
          </button>

          {!readOnly && (
            <div className="flex shrink-0 items-center gap-2">
              {saved && !isEditing && (
                <span className="flex items-center gap-1 text-xs text-emerald-700">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  Saved
                </span>
              )}
              {!isEditing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={onEdit}
                  aria-label={`Edit ${label}`}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-3 px-4 pb-4 pt-0 text-xs break-words">
          {isEditing && editDraft ? (
            <>
              <PolicyField
                label="Verbatim text"
                id={`${policy.type}-verbatim`}
                value={editDraft.verbatimText}
                onChange={(value) => onDraftChange('verbatimText', value)}
                rows={4}
                className="italic"
              />
              <PolicyField
                label="Interpretation"
                id={`${policy.type}-interpretation`}
                value={editDraft.interpretation}
                onChange={(value) => onDraftChange('interpretation', value)}
                rows={3}
              />
              <PolicyField
                label="Calculation applied"
                id={`${policy.type}-calculation`}
                value={editDraft.calculationApplied}
                onChange={(value) => onDraftChange('calculationApplied', value)}
                rows={2}
                mono
              />
              <PolicyField
                label="PE services affected (comma-separated)"
                id={`${policy.type}-services`}
                value={editDraft.peServicesAffected.join(', ')}
                onChange={(value) =>
                  onDraftChange(
                    'peServicesAffected',
                    value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                rows={2}
              />
              <div className="flex gap-2 pt-1">
                <Button type="button" size="sm" onClick={onSave} disabled={!canSave}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="font-medium text-muted-foreground">Verbatim text:</span>
                <blockquote className="mt-1 pl-3 border-l-2 border-border text-foreground/80 italic whitespace-pre-wrap">
                  {policy.verbatimText}
                </blockquote>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Interpretation:</span>
                <p className="mt-1 whitespace-pre-wrap">{policy.interpretation}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Calculation applied:</span>
                <p className="mt-1 font-mono whitespace-pre-wrap">{policy.calculationApplied}</p>
              </div>
              {policy.peServicesAffected.length > 0 && (
                <div>
                  <span className="font-medium text-muted-foreground">PE services affected:</span>
                  <p className="mt-1 whitespace-pre-wrap">
                    {policy.peServicesAffected.join(', ')}
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

function PolicyField({
  label,
  id,
  value,
  onChange,
  rows,
  mono,
  className,
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  rows: number
  mono?: boolean
  className?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(mono && 'font-mono', className)}
      />
    </div>
  )
}
