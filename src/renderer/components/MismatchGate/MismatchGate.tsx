import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Mismatch, MismatchResolution } from '@shared/types'

interface Props {
  mismatches: Mismatch[]
  existingResolutions?: MismatchResolution[]
  onResolveAll: (resolutions: MismatchResolution[]) => void
  onCancel?: () => void
  submitLabel?: string
}

type Resolution = 'use_form' | 'use_pdf' | 'other'

interface LocalState {
  resolution: Resolution | null
  otherNote: string
}

export function MismatchGate({
  mismatches,
  existingResolutions = [],
  onResolveAll,
  onCancel,
  submitLabel = 'Apply Resolutions & Continue',
}: Props) {
  const [local, setLocal] = useState<Record<string, LocalState>>(() => {
    const byId = new Map(existingResolutions.map((r) => [r.id, r]))
    return Object.fromEntries(
      mismatches.map((m) => {
        const existing = byId.get(m.id)
        if (existing) {
          return [
            m.id,
            {
              resolution: existing.resolution,
              otherNote: existing.otherNote ?? '',
            },
          ]
        }
        return [m.id, { resolution: null, otherNote: '' }]
      }),
    )
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const resolvedCount = mismatches.filter((m) => local[m.id]?.resolution !== null).length
  const allResolved = resolvedCount === mismatches.length

  const setResolution = (id: string, resolution: Resolution) => {
    setValidationError(null)
    setLocal((prev) => ({ ...prev, [id]: { ...prev[id], resolution } }))
  }

  const setOtherNote = (id: string, note: string) =>
    setLocal((prev) => ({ ...prev, [id]: { ...prev[id], otherNote: note } }))

  const handleSubmit = () => {
    const missingOther = mismatches.some((m) => {
      const l = local[m.id]
      return l?.resolution === 'other' && !l.otherNote.trim()
    })

    if (missingOther) {
      setValidationError('Please specify a value for every "Other" resolution.')
      return
    }

    if (!allResolved) return

    const resolutions: MismatchResolution[] = mismatches.map((m) => {
      const l = local[m.id]
      const chosenValue =
        l.resolution === 'use_form'
          ? m.formValue
          : l.resolution === 'use_pdf'
            ? m.pdfValue
            : l.otherNote.trim()
      return {
        id: m.id,
        field: m.field,
        chosenValue,
        resolution: l.resolution!,
        otherNote: l.resolution === 'other' ? l.otherNote.trim() : null,
      }
    })
    onResolveAll(resolutions)
  }

  if (mismatches.length === 0) return null

  return (
    <Dialog open>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Form vs PDF Discrepancies — Resolution Required</DialogTitle>
          <DialogDescription>
            You must make an explicit choice on every line before proceeding. No default selection
            is applied.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-y-auto flex-1 py-1">
          {mismatches.map((mismatch) => {
            const state = local[mismatch.id]
            const isOther = state?.resolution === 'other'
            const groupName = `mismatch-${mismatch.id}`

            return (
              <fieldset
                key={mismatch.id}
                className="rounded-lg border border-border bg-muted/30 p-4"
              >
                <legend className="text-sm font-semibold px-1">
                  {mismatch.section}: {mismatch.field}
                </legend>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-3 text-xs">
                  <div className="bg-background rounded p-2 border border-border">
                    <p className="text-muted-foreground font-medium mb-0.5">Contract Form value</p>
                    <p className="text-foreground">{mismatch.formValue}</p>
                  </div>
                  <div className="bg-background rounded p-2 border border-border">
                    <p className="text-muted-foreground font-medium mb-0.5">PDF value</p>
                    <p className="text-foreground">{mismatch.pdfValue}</p>
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-label={`Resolution for ${mismatch.field}`}
                  className="flex flex-col gap-2"
                >
                  {(['use_form', 'use_pdf', 'other'] as const).map((choice) => {
                    const id = `${groupName}-${choice}`
                    const label =
                      choice === 'use_form'
                        ? 'Use Form'
                        : choice === 'use_pdf'
                          ? 'Use PDF'
                          : 'Other (specify)'
                    const checked = state?.resolution === choice

                    return (
                      <div key={choice} className="flex items-center gap-2">
                        <button
                          type="button"
                          id={id}
                          role="radio"
                          aria-checked={checked}
                          className={cn(
                            'flex-1 text-left px-3 py-2 rounded-md border text-sm transition-colors',
                            checked
                              ? 'border-primary bg-primary/5 font-medium'
                              : 'border-border hover:border-primary/40',
                          )}
                          onClick={() => setResolution(mismatch.id, choice)}
                        >
                          {label}
                        </button>
                      </div>
                    )
                  })}
                </div>

                {isOther && (
                  <div className="mt-2">
                    <Label htmlFor={`${groupName}-note`} className="sr-only">
                      Other resolution for {mismatch.field}
                    </Label>
                    <Input
                      id={`${groupName}-note`}
                      value={state.otherNote}
                      onChange={(e) => setOtherNote(mismatch.id, e.target.value)}
                      placeholder="Specify the value to use…"
                      aria-required="true"
                      aria-invalid={!state.otherNote.trim()}
                    />
                  </div>
                )}
              </fieldset>
            )
          })}
        </div>

        {validationError && (
          <p className="text-xs text-destructive" role="alert">
            {validationError}
          </p>
        )}

        <DialogFooter className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {resolvedCount} of {mismatches.length} resolved
          </p>
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <Button onClick={handleSubmit} disabled={!allResolved}>
              {submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
