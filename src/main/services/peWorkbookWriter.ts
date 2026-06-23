import ExcelJS from 'exceljs'
import {
  PE_EXTRAS_COLUMNS,
  PE_RATES_COLUMNS,
  PE_VALIDATION_COLUMNS,
} from '../../shared/constants'
import { formatPeBool, formatPeDate } from '../../shared/peFormat'
import type { ExtrasRow, RateRow, ValidationNote } from '../../shared/types'

const HEADER_FILL = 'FFD9E1F2'

function rateRowToPeRecord(row: RateRow): Record<string, string | number> {
  return {
    'Supplier Name': row.supplierName,
    'Supplier ID': row.supplierId,
    'Supplier Code': row.supplierCode,
    'Service Name': row.serviceName,
    'Service ID': row.serviceId,
    'Service Code': row.serviceCode,
    'Date From': formatPeDate(row.dateFrom),
    'Date To': formatPeDate(row.dateTo),
    'Agent Group ID': row.agentGroupId,
    'Rate Code': row.rateCode,
    'Rate Name': row.rateName,
    'Rate Plan': row.ratePlan,
    'Currency Code': row.currencyCode,
    'Adult Buy': row.adultBuy,
    'Adult Sell': row.adultSell,
    'Child Cost': row.childCost,
    'Child Sell': row.childSell,
    Markup: row.markup,
    'Min Pax': row.minPax,
    'Max Pax': row.maxPax,
    'Min Stay': row.minStay,
    'Max Stay': row.maxStay,
    API: formatPeBool(row.api),
    'Is Exception': formatPeBool(row.isException),
    Business_Model: row.businessModel,
    Supplier_Commission: row.supplierCommission,
  }
}

function extrasRowToPeRecord(row: ExtrasRow): Record<string, string | number> {
  const rec: Record<string, string | number> = {
    'Supplier Name': row.supplierName,
    'Supplier Code': row.supplierCode,
    'Supplier Id': row.supplierId,
    'Service Name': row.parentServiceName,
    'Service Code': row.parentServiceCode,
    'Service ID': row.parentServiceId,
    'Extra Type': row.extraType,
    'Extra Name': row.extraName,
    'Date From': formatPeDate(row.dateFrom),
    'Date To': formatPeDate(row.dateTo),
    'Agent Group ID': row.agentGroupId,
    'Rate Code': row.rateCode,
    'Rate Name': row.rateName,
    Currency: row.currency,
    Cost: row.cost ?? '',
    Sell: row.sell ?? '',
    'Price Percent': row.pricePercent ?? '',
    'Tax Code': row.taxCode,
    'Child Only': formatPeBool(row.childOnly),
    'Infant Only': formatPeBool(row.infantOnly),
    Markup: formatPeBool(row.markup),
    Discount: formatPeBool(row.discount),
    Mandatory: formatPeBool(row.mandatory),
    'No Report': formatPeBool(row.noReport),
    Commission: formatPeBool(row.commission),
    'Capacity Change': formatPeBool(row.capacityChange),
    Percent_from_child_price: formatPeBool(row.percentFromChildPrice),
    No_Voucher: formatPeBool(row.noVoucher),
  }
  return rec
}

function styleHeaderRow(sheet: ExcelJS.Worksheet, colCount: number): void {
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, name: 'Arial', size: 10 }
  for (let c = 1; c <= colCount; c++) {
    const cell = headerRow.getCell(c)
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: HEADER_FILL },
    }
  }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
}

function addSheetFromRecords(
  workbook: ExcelJS.Workbook,
  name: string,
  columns: readonly string[],
  records: Record<string, string | number>[],
): void {
  const sheet = workbook.addWorksheet(name)
  sheet.columns = columns.map((h) => ({ header: h, key: h, width: Math.min(28, h.length + 4) }))
  for (const rec of records) {
    sheet.addRow(rec)
  }
  styleHeaderRow(sheet, columns.length)
}

export async function buildPeWorkbookBuffer(
  rateRows: RateRow[],
  extrasRows: ExtrasRow[],
  validationNotes: ValidationNote[],
): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook()

  addSheetFromRecords(
    workbook,
    'Rates',
    PE_RATES_COLUMNS,
    rateRows.map(rateRowToPeRecord),
  )

  if (extrasRows.length > 0) {
    addSheetFromRecords(
      workbook,
      'Extras',
      PE_EXTRAS_COLUMNS,
      extrasRows.map(extrasRowToPeRecord),
    )
  }

  if (validationNotes.length > 0) {
    const noteRecords = validationNotes.map((n) => ({
      'Item Type': n.itemType,
      'Service Name': n.serviceName,
      Issue: n.issue,
      'Action Required': n.actionRequired,
    }))
    addSheetFromRecords(workbook, 'Validation Notes', PE_VALIDATION_COLUMNS, noteRecords)
  }

  const buf = await workbook.xlsx.writeBuffer()
  return buf as ArrayBuffer
}
