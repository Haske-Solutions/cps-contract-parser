import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ServiceMatch } from '@shared/types'
import { EditableDataGrid } from '@/lib/dataGrid/EditableDataGrid'
import { buildServiceMatchColumns } from '@/lib/dataGrid/columnBuilders'
import { createEmptyServiceMatch } from '@/lib/dataGrid/rowFactories'
import { serviceMatchGridId } from '@/lib/dataGrid/types'

interface Props {
  serviceMatches: ServiceMatch[]
  extrasMatches: ServiceMatch[]
  policyMatches?: ServiceMatch[]
  onSelectServiceMatch: (extractedName: string, candidateId: number) => void
  onSelectExtrasMatch: (extractedName: string, candidateId: number) => void
  onSelectPolicyMatch: (extractedName: string, candidateId: number) => void
  onServiceMatchesChange: (matches: ServiceMatch[]) => void
  onExtrasMatchesChange: (matches: ServiceMatch[]) => void
  onPolicyMatchesChange: (matches: ServiceMatch[]) => void
  onContinue: () => void
}

export function ServiceMatchingPanel({
  serviceMatches,
  extrasMatches,
  policyMatches = [],
  onSelectServiceMatch,
  onSelectExtrasMatch,
  onSelectPolicyMatch,
  onServiceMatchesChange,
  onExtrasMatchesChange,
  onPolicyMatchesChange,
  onContinue,
}: Props) {
  const needsCreationCount = [...serviceMatches, ...extrasMatches, ...policyMatches].filter(
    (m) => m.status === 'needs_creation',
  ).length
  const multipleCount = [...serviceMatches, ...extrasMatches, ...policyMatches].filter(
    (m) => m.status === 'multiple_matches',
  ).length

  return (
    <section aria-labelledby="step3-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="step3-heading" className="text-base font-heading font-semibold">
            PE Service Matching
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use Add row / Delete row to adjust matches. Click Extracted Name to edit manual entries.
          </p>
        </div>
        <div className="flex gap-2">
          {needsCreationCount > 0 && (
            <Badge variant="outline" className="bg-needs_creation">
              {needsCreationCount} needs creation
            </Badge>
          )}
          {multipleCount > 0 && (
            <Badge variant="outline">{multipleCount} multiple matches</Badge>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <ServiceMatchGrid
          title="Accommodation Services"
          matches={serviceMatches}
          onSelectCandidate={onSelectServiceMatch}
          onRowsChange={onServiceMatchesChange}
        />
        <ServiceMatchGrid
          title="Extras / Park Fees / Conservancy"
          matches={extrasMatches}
          onSelectCandidate={onSelectExtrasMatch}
          onRowsChange={onExtrasMatchesChange}
        />
        <ServiceMatchGrid
          title="Policy Services"
          matches={policyMatches}
          onSelectCandidate={onSelectPolicyMatch}
          onRowsChange={onPolicyMatchesChange}
        />
      </div>

      <Button onClick={onContinue} className="self-start">
        Continue to Prior Year Comparison
      </Button>
    </section>
  )
}

function ServiceMatchGrid({
  title,
  matches,
  onSelectCandidate,
  onRowsChange,
}: {
  title: string
  matches: ServiceMatch[]
  onSelectCandidate: (extractedName: string, candidateId: number) => void
  onRowsChange: (matches: ServiceMatch[]) => void
}) {
  const columns = useMemo(
    () => buildServiceMatchColumns(onSelectCandidate),
    [onSelectCandidate],
  )

  const createEmptyRow = useCallback(
    () => createEmptyServiceMatch(matches[0]),
    [matches],
  )

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="w-full p-0 pb-2">
        <EditableDataGrid
          columns={columns}
          rows={matches}
          rowKeyFn={serviceMatchGridId}
          onRowsChange={onRowsChange}
          createEmptyRow={createEmptyRow}
          height={288}
          ariaLabel={title}
        />
      </CardContent>
    </Card>
  )
}
