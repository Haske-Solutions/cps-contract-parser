import { useMemo, useState } from 'react'
import DataGrid, { type Column, type RowsChangeData, textEditor } from 'react-data-grid'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { WithGridId } from './types'

interface Props<T> {
  columns: Column<WithGridId<T>>[]
  rows: T[]
  rowKeyFn: (row: T, index: number) => string
  onRowsChange?: (rows: T[]) => void
  createEmptyRow?: () => T
  rowClass?: (row: T, rowIdx: number) => string | undefined
  ariaLabel: string
  className?: string
  height?: number | string
  readOnly?: boolean
  coerceRow?: (row: WithGridId<T>, columnKey: string) => WithGridId<T>
}

export function EditableDataGrid<T>({
  columns,
  rows,
  rowKeyFn,
  onRowsChange,
  createEmptyRow,
  rowClass,
  ariaLabel,
  className,
  height = 256,
  readOnly = false,
  coerceRow,
}: Props<T>) {
  const editable = !readOnly && Boolean(onRowsChange)
  const allowAddRow = editable && Boolean(createEmptyRow)
  const allowDeleteRow = editable
  const showRowToolbar = allowAddRow || allowDeleteRow
  const [selectedRowIdx, setSelectedRowIdx] = useState<number | null>(null)

  const displayColumns = useMemo(() => {
    if (!editable) {
      return columns.map((col) => ({ ...col, editable: false }))
    }
    return columns.map((col) => {
      if (!col.editable || col.renderEditCell) return col
      return { ...col, renderEditCell: textEditor }
    })
  }, [columns, editable])

  const gridRows = useMemo(
    () =>
      rows.map((row, index) => ({
        ...row,
        __gridId: `${rowKeyFn(row, index)}::${index}`,
      })) as WithGridId<T>[],
    [rows, rowKeyFn],
  )

  const handleRowsChange = (nextRows: WithGridId<T>[], data: RowsChangeData<WithGridId<T>>) => {
    if (!onRowsChange) return
    const columnKey = data.column.key
    const mapped = nextRows.map((row) => {
      const coerced = coerceRow ? coerceRow(row, columnKey) : row
      const { __gridId: _id, ...rest } = coerced
      return rest as T
    })
    onRowsChange(mapped)
  }

  const handleAddRow = () => {
    if (!onRowsChange || !createEmptyRow) return
    onRowsChange([...rows, createEmptyRow()])
    setSelectedRowIdx(rows.length)
  }

  const handleDeleteRow = () => {
    if (!onRowsChange || selectedRowIdx === null) return
    const next = rows.filter((_, index) => index !== selectedRowIdx)
    onRowsChange(next)
    setSelectedRowIdx(null)
  }

  const mergedRowClass = (row: WithGridId<T>, rowIdx: number) =>
    cn(
      rowClass?.(row as T, rowIdx),
      selectedRowIdx === rowIdx && 'rdg-row-selected',
    )

  return (
    <div className="flex w-full flex-col">
      {showRowToolbar && (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground">
            {selectedRowIdx === null && rows.length > 0
              ? 'Click a row to select it for deletion'
              : '\u00a0'}
          </p>
          <div className="flex items-center gap-2">
            {allowAddRow && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={handleAddRow}>
                <Plus className="size-3.5" data-icon="inline-start" />
                Add row
              </Button>
            )}
            {allowDeleteRow && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={handleDeleteRow}
                disabled={selectedRowIdx === null || rows.length === 0}
              >
                <Trash2 className="size-3.5" data-icon="inline-start" />
                Delete row
              </Button>
            )}
          </div>
        </div>
      )}
      <DataGrid
        className={cn('rdg-light text-xs w-full', className)}
        style={{ blockSize: height }}
        columns={displayColumns}
        rows={gridRows}
        rowKeyGetter={(row) => row.__gridId}
        onRowsChange={editable ? handleRowsChange : undefined}
        onCellClick={(args) => {
          const rowIdx = gridRows.findIndex((row) => row.__gridId === args.row.__gridId)
          setSelectedRowIdx(rowIdx >= 0 ? rowIdx : null)
          if (!editable) return
          const column = args.column
          const isEditable =
            typeof column.editable === 'function'
              ? column.editable(args.row)
              : column.editable
          if (isEditable) args.selectCell(true)
        }}
        onSelectedCellChange={(args) => setSelectedRowIdx(args.rowIdx)}
        rowHeight={32}
        headerRowHeight={34}
        rowClass={mergedRowClass}
        aria-label={ariaLabel}
      />
    </div>
  )
}
