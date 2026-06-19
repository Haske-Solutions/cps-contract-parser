import { useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Download, XCircle } from 'lucide-react'
import type { RateRow, ExtrasRow } from '@shared/types'
import { RATE_CHANGE_THRESHOLD_PCT } from '@shared/constants'
import { EditableDataGrid } from '@/lib/dataGrid/EditableDataGrid'
import { buildRateRowColumns, buildExtrasRowColumns } from '@/lib/dataGrid/columnBuilders'
import { coerceRateRow, coerceExtrasRow } from '@/lib/dataGrid/coerceRowValues'
import { createEmptyRateRow, createEmptyExtrasRow } from '@/lib/dataGrid/rowFactories'
import { rateRowGridId } from '@/lib/dataGrid/types'

export type ExportRowSeed = Partial<Pick<
  RateRow,
  'supplierName' | 'supplierId' | 'supplierCode' | 'validFrom' | 'validTo' | 'ratePlan' | 'rateCode'
>>

interface Props {
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  needsCreationServiceIds: Set<number>
  rateChangeServiceIds?: Set<number>
  rowSeed?: ExportRowSeed
  onRateRowsChange?: (rows: RateRow[]) => void
  onExtrasRowsChange?: (rows: ExtrasRow[]) => void
  onDownload: () => void
  isDownloading?: boolean
  isGenerating?: boolean
  hasStop?: boolean
  downloadReady?: boolean
}

function rowSurfaceClass(isNeedsCreation: boolean, isRateChange: boolean): string {
  if (isNeedsCreation) return 'bg-needs_creation'
  if (isRateChange) return 'bg-rate_change'
  return ''
}

export function ExcelPreview({
  rateRows,
  extrasRows,
  needsCreationServiceIds,
  rateChangeServiceIds = new Set(),
  rowSeed,
  onRateRowsChange,
  onExtrasRowsChange,
  onDownload,
  isDownloading = false,
  isGenerating = false,
  hasStop = false,
  downloadReady = true,
}: Props) {
  const downloadDisabled = isDownloading || isGenerating || hasStop || !downloadReady
  const rateColumns = useMemo(() => buildRateRowColumns(), [])
  const extrasColumns = useMemo(() => buildExtrasRowColumns(), [])
  const ratesEditable = Boolean(onRateRowsChange)
  const extrasEditable = Boolean(onExtrasRowsChange)

  const createRateRow = useCallback(
    () => createEmptyRateRow(rateRows[0] ?? rowSeed),
    [rateRows, rowSeed],
  )

  const createExtrasRow = useCallback(
    () => createEmptyExtrasRow(extrasRows[0] ?? rowSeed),
    [extrasRows, rowSeed],
  )

  const rateRowClass = (row: RateRow) => {
    const isNeedsCreation = needsCreationServiceIds.has(row.serviceId)
    const isRateChange = !isNeedsCreation && rateChangeServiceIds.has(row.serviceId)
    return rowSurfaceClass(isNeedsCreation, isRateChange)
  }

  const extrasRowClass = (row: ExtrasRow) =>
    rowSurfaceClass(needsCreationServiceIds.has(row.serviceId), false)

  return (
    <section aria-labelledby="excel-preview-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="excel-preview-heading" className="text-sm font-semibold">
            Workbook Preview
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Edits apply to the downloaded workbook. Use Add row / Delete row to change each sheet.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Button onClick={onDownload} disabled={downloadDisabled}>
              <Download data-icon="inline-start" />
              {isDownloading
                ? 'Saving…'
                : isGenerating
                  ? 'Generating…'
                  : 'Download Excel'}
            </Button>
          </TooltipTrigger>
          {!downloadReady && !isGenerating && (
            <TooltipContent>Excel file is still being generated</TooltipContent>
          )}
        </Tooltip>
      </div>

      {hasStop && (
        <Alert variant="destructive">
          <XCircle className="size-4" />
          <AlertDescription>
            Download is blocked until all STOP-severity validation flags are resolved.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-needs_creation border border-border" />
          Needs Creation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm bg-rate_change border border-border" />
          &gt;{RATE_CHANGE_THRESHOLD_PCT}% rate change
        </span>
      </div>

      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Rates <Badge variant="secondary">{rateRows.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {ratesEditable || rateRows.length > 0 ? (
              <EditableDataGrid
                columns={rateColumns}
                rows={rateRows}
                rowKeyFn={rateRowGridId}
                onRowsChange={onRateRowsChange}
                createEmptyRow={ratesEditable ? createRateRow : undefined}
                rowClass={rateRowClass}
                coerceRow={coerceRateRow}
                height={420}
                ariaLabel="Rates sheet preview"
              />
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No rate rows generated
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              Extras <Badge variant="secondary">{extrasRows.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {extrasEditable || extrasRows.length > 0 ? (
              <EditableDataGrid
                columns={extrasColumns}
                rows={extrasRows}
                rowKeyFn={rateRowGridId}
                onRowsChange={onExtrasRowsChange}
                createEmptyRow={extrasEditable ? createExtrasRow : undefined}
                rowClass={extrasRowClass}
                coerceRow={coerceExtrasRow}
                height={420}
                ariaLabel="Extras sheet preview"
              />
            ) : (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No extras rows generated
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
