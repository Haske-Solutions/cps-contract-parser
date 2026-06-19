import { useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { PriorRate } from '@shared/types'
import { EditableDataGrid } from '@/lib/dataGrid/EditableDataGrid'
import { buildPriorRateColumns } from '@/lib/dataGrid/columnBuilders'
import { coercePriorRate } from '@/lib/dataGrid/coerceRowValues'
import { createEmptyPriorRate } from '@/lib/dataGrid/rowFactories'
import { priorRateGridId } from '@/lib/dataGrid/types'
import { isHighRateChange, type PriorRateWithNew } from '../../lib/rateComparison'

interface Props {
  priorRates: PriorRateWithNew[]
  onPriorRatesChange: (rates: PriorRate[]) => void
  onContinue: () => void
}

function toStoredPriorRate(row: PriorRateWithNew): PriorRate {
  const { newRate: _newRate, ...stored } = row
  return stored
}

export function PriorRatePanel({ priorRates, onPriorRatesChange, onContinue }: Props) {
  const columns = useMemo(() => buildPriorRateColumns(), [])

  const createEmptyRow = useCallback((): PriorRateWithNew => {
    const base = createEmptyPriorRate(priorRates[0])
    return { ...base, newRate: null }
  }, [priorRates])

  const handleRowsChange = useCallback(
    (rows: PriorRateWithNew[]) => {
      onPriorRatesChange(rows.map(toStoredPriorRate))
    },
    [onPriorRatesChange],
  )

  const rowClass = (row: PriorRateWithNew) => (isHighRateChange(row) ? 'bg-rate_change' : '')

  return (
    <section aria-labelledby="step4-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="step4-heading" className="text-base font-heading font-semibold">
          Prior Year Rate Comparison
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Click cells to edit service names and prior rates. Use Add row / Delete row to adjust the
          table. New rate and % change update from extracted rates.
        </p>
      </div>

      {priorRates.length === 0 && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            No prior year rates found for this supplier. Add rows manually or continue without
            comparison.
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <EditableDataGrid
            columns={columns}
            rows={priorRates}
            rowKeyFn={priorRateGridId}
            onRowsChange={handleRowsChange}
            createEmptyRow={createEmptyRow}
            rowClass={rowClass}
            coerceRow={coercePriorRate}
            height={360}
            ariaLabel="Prior year rate comparison"
          />
        </CardContent>
      </Card>

      <Button onClick={onContinue} className="self-start">
        Continue to Excel Generation
      </Button>
    </section>
  )
}
