import type { Column, RenderCellProps } from 'react-data-grid'
import type { ExtractedRate, ExtrasRow, RateRow, ServiceMatch } from '@shared/types'
import {
  formatRateRecordKeyLabel,
  formatRateRecordKeyTooltip,
  isRateRecordKey,
} from '@shared/serviceTokenMatcher'
import { PE_EXTRAS_COLUMNS, PE_RATES_COLUMNS, RATE_CHANGE_THRESHOLD_PCT } from '@shared/constants'
import { isHighRateChange, type PriorRateWithNew } from '@shared/rateComparison'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  EXTRACTED_RATE_EDITABLE_KEYS,
  EXTRAS_ROW_EDITABLE_KEYS,
  PRIOR_RATE_EDITABLE_KEYS,
  RATE_ROW_EDITABLE_KEYS,
} from './editability'
import { formatCellValue } from './formatters'
import type { WithGridId } from './types'

type FieldConfig<T> = {
  key: keyof T & string
  name: string
  frozen?: boolean
  editable?: boolean
  width?: number
  mono?: boolean
}

const RATE_ROW_FIELDS: FieldConfig<RateRow>[] = [
  { key: 'supplierName', name: 'Supplier Name', frozen: true, width: 140 },
  { key: 'supplierId', name: 'Supplier ID', width: 90 },
  { key: 'supplierCode', name: 'Supplier Code', width: 100 },
  { key: 'serviceName', name: 'Service Name', width: 160 },
  { key: 'serviceId', name: 'Service ID', width: 90 },
  { key: 'serviceCode', name: 'Service Code', width: 100 },
  { key: 'dateFrom', name: 'Date From', editable: true, width: 100 },
  { key: 'dateTo', name: 'Date To', editable: true, width: 100 },
  { key: 'agentGroupId', name: 'Agent Group ID', width: 100 },
  { key: 'rateCode', name: 'Rate Code', editable: true, width: 90 },
  { key: 'rateName', name: 'Rate Name', editable: true, width: 120 },
  { key: 'ratePlan', name: 'Rate Plan', editable: true, width: 100 },
  { key: 'currencyCode', name: 'Currency Code', width: 90 },
  { key: 'adultBuy', name: 'Adult Buy', editable: true, width: 90, mono: true },
  { key: 'adultSell', name: 'Adult Sell', editable: true, width: 90, mono: true },
  { key: 'childCost', name: 'Child Cost', editable: true, width: 90, mono: true },
  { key: 'childSell', name: 'Child Sell', editable: true, width: 90, mono: true },
  { key: 'markup', name: 'Markup', width: 70 },
  { key: 'minPax', name: 'Min Pax', editable: true, width: 70 },
  { key: 'maxPax', name: 'Max Pax', editable: true, width: 70 },
  { key: 'minStay', name: 'Min Stay', editable: true, width: 70 },
  { key: 'maxStay', name: 'Max Stay', editable: true, width: 70 },
  { key: 'api', name: 'API', width: 60 },
  { key: 'isException', name: 'Is Exception', editable: true, width: 90 },
  { key: 'businessModel', name: 'Business_Model', width: 100 },
  { key: 'supplierCommission', name: 'Supplier_Commission', width: 120 },
]

const EXTRAS_ROW_FIELDS: FieldConfig<ExtrasRow>[] = [
  { key: 'supplierName', name: 'Supplier Name', frozen: true, width: 140 },
  { key: 'supplierCode', name: 'Supplier Code', width: 100 },
  { key: 'supplierId', name: 'Supplier Id', width: 90 },
  { key: 'parentServiceName', name: 'Service Name', width: 160 },
  { key: 'parentServiceCode', name: 'Service Code', width: 100 },
  { key: 'parentServiceId', name: 'Service ID', width: 90 },
  { key: 'extraType', name: 'Extra Type', width: 90 },
  { key: 'extraName', name: 'Extra Name', editable: true, width: 180 },
  { key: 'dateFrom', name: 'Date From', editable: true, width: 100 },
  { key: 'dateTo', name: 'Date To', editable: true, width: 100 },
  { key: 'rateCode', name: 'Rate Code', editable: true, width: 90 },
  { key: 'cost', name: 'Cost', editable: true, width: 80, mono: true },
  { key: 'sell', name: 'Sell', editable: true, width: 80, mono: true },
  { key: 'pricePercent', name: 'Price Percent', editable: true, width: 100 },
  { key: 'taxCode', name: 'Tax Code', width: 80 },
  { key: 'childOnly', name: 'Child Only', width: 80 },
  { key: 'mandatory', name: 'Mandatory', width: 80 },
]

const EXTRACTED_RATE_FIELDS: FieldConfig<ExtractedRate>[] = [
  { key: 'propertyName', name: 'Property', editable: true, frozen: true, width: 140 },
  { key: 'roomType', name: 'Room Type', editable: true, width: 120 },
  { key: 'seasonName', name: 'Season', editable: true, width: 100 },
  { key: 'validFrom', name: 'Valid From', editable: true, width: 100 },
  { key: 'validTo', name: 'Valid To', editable: true, width: 100 },
  { key: 'rateAmount', name: 'Rate', editable: true, width: 90, mono: true },
  { key: 'currency', name: 'Currency', editable: true, width: 80 },
  { key: 'rateCode', name: 'Code', editable: true, width: 80 },
  { key: 'mealBasis', name: 'Meal Basis', editable: true, width: 100 },
  { key: 'notes', name: 'Notes', editable: true, width: 160 },
]

function buildColumnsFromFields<T extends object>(
  fields: FieldConfig<T>[],
  editableKeys: Set<keyof T>,
): Column<WithGridId<T>>[] {
  return fields.map((field) => {
    const isEditable = field.editable ?? editableKeys.has(field.key)

    return {
      key: field.key,
      name: field.name,
      width: field.width,
      minWidth: 60,
      frozen: field.frozen,
      editable: isEditable,
      cellClass: field.mono ? 'font-mono text-xs' : 'text-xs',
      ...(!isEditable
        ? {
            renderCell: ({ row }: RenderCellProps<WithGridId<T>>) =>
              formatCellValue(row[field.key]),
          }
        : {}),
    } satisfies Column<WithGridId<T>>
  })
}

export function buildRateRowColumns(): Column<WithGridId<RateRow>>[] {
  void PE_RATES_COLUMNS
  return buildColumnsFromFields(RATE_ROW_FIELDS, RATE_ROW_EDITABLE_KEYS)
}

export function buildExtrasRowColumns(): Column<WithGridId<ExtrasRow>>[] {
  void PE_EXTRAS_COLUMNS
  return buildColumnsFromFields(EXTRAS_ROW_FIELDS, EXTRAS_ROW_EDITABLE_KEYS)
}

export function buildExtractedRateColumns(): Column<WithGridId<ExtractedRate>>[] {
  return buildColumnsFromFields(EXTRACTED_RATE_FIELDS, EXTRACTED_RATE_EDITABLE_KEYS)
}

function ExtractedNameCell({ value }: { value: string }) {
  const label = formatRateRecordKeyLabel(value)
  const showTooltip = isRateRecordKey(value)

  const content = (
    <span className="block whitespace-normal break-words leading-snug py-0.5">
      {label}
    </span>
  )

  if (!showTooltip) return content

  return (
    <Tooltip>
      <TooltipTrigger className="block w-full text-left">{content}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-sm whitespace-pre-line text-xs">
        {formatRateRecordKeyTooltip(value)}
      </TooltipContent>
    </Tooltip>
  )
}

export function buildServiceMatchColumns(
  onSelectCandidate: (extractedName: string, candidateId: number) => void,
): Column<WithGridId<ServiceMatch>>[] {
  return [
    {
      key: 'extractedName',
      name: 'Extracted Name',
      minWidth: 260,
      width: 'minmax(260px, 1.4fr)',
      frozen: true,
      editable: (row) => !isRateRecordKey(row.extractedName),
      cellClass: 'whitespace-normal align-top',
      renderCell: ({ row }: RenderCellProps<WithGridId<ServiceMatch>>) => (
        <ExtractedNameCell value={row.extractedName} />
      ),
    },
    {
      key: 'peServiceName',
      name: 'Matched PE Service',
      minWidth: 160,
      width: 'minmax(160px, 200px)',
      renderCell: ({ row }) => {
        if (row.status === 'multiple_matches' && row.candidates.length > 0) {
          return (
            <select
              className="cp-native-select h-7 w-full rounded border border-input bg-background pl-2 text-xs"
              value={row.peServiceId ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value)
                if (Number.isFinite(id)) onSelectCandidate(row.extractedName, id)
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Select service…</option>
              {row.candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          )
        }
        return row.peServiceName ?? '—'
      },
    },
    {
      key: 'peServiceId',
      name: 'Service ID',
      width: 90,
      cellClass: 'font-mono text-xs',
      renderCell: ({ row }) => formatCellValue(row.peServiceId),
    },
    {
      key: 'status',
      name: 'Status',
      width: 120,
      renderCell: ({ row }) => {
        const labels: Record<ServiceMatch['status'], string> = {
          matched: 'Matched',
          needs_creation: 'Needs creation',
          multiple_matches: 'Multiple matches',
          unused: 'Unused',
        }
        return labels[row.status]
      },
    },
  ]
}

const PRIOR_RATE_FIELDS: FieldConfig<PriorRateWithNew>[] = [
  { key: 'serviceName', name: 'Service Name', frozen: true, editable: true, width: 200 },
  { key: 'adultCost', name: 'Prior Adult Rate', editable: true, width: 120, mono: true },
]

export function buildPriorRateColumns(): Column<WithGridId<PriorRateWithNew>>[] {
  const editableKeys = PRIOR_RATE_EDITABLE_KEYS
  const base = buildColumnsFromFields(PRIOR_RATE_FIELDS, editableKeys)

  return [
    ...base,
    {
      key: 'newRate',
      name: 'New Rate',
      width: 110,
      cellClass: 'font-mono text-xs',
      renderCell: ({ row }: RenderCellProps<WithGridId<PriorRateWithNew>>) =>
        row.newRate !== null ? row.newRate.toLocaleString() : '—',
    },
    {
      key: 'percentChange',
      name: '% Change',
      width: 90,
      cellClass: 'font-mono text-xs',
      renderCell: ({ row }: RenderCellProps<WithGridId<PriorRateWithNew>>) =>
        row.percentChange !== null ? `${row.percentChange.toFixed(1)}%` : '—',
    },
    {
      key: 'rateType',
      name: 'Flag',
      width: 110,
      renderCell: ({ row }: RenderCellProps<WithGridId<PriorRateWithNew>>) =>
        isHighRateChange(row) ? (
          <Badge variant="outline" className="text-accent-foreground border-accent">
            &gt;{RATE_CHANGE_THRESHOLD_PCT}%
          </Badge>
        ) : (
          '—'
        ),
    },
  ]
}
