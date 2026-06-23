import { collectMismatches } from './mismatchCollector'
import type {
  ConfirmedPolicy,
  ExtractionResult,
  Mismatch,
  MismatchResolution,
  ParseSession,
  PriorRate,
  ServiceInventoryCounts,
  ServiceMatch,
  Supplier,
  ValidationFlag,
} from './types'

export type ExportSessionMode = 'interactive' | 'batch'

export function autoConfirmedPolicies(extraction: ExtractionResult): ConfirmedPolicy[] {
  return extraction.policies.map((p) => ({ type: p.type, confirmed: true }))
}

export interface BuildExportSessionParams {
  id: string
  createdAt?: string
  supplier: Supplier
  extraction: ExtractionResult
  serviceMatches: ServiceMatch[]
  extrasMatches: ServiceMatch[]
  policyMatches: ServiceMatch[]
  priorRates: PriorRate[]
  confirmedPolicies?: ConfirmedPolicy[]
  mismatches?: Mismatch[]
  mismatchResolutions?: MismatchResolution[]
  inventoryCounts?: ServiceInventoryCounts | null
  mode: ExportSessionMode
  step?: ParseSession['step']
  status?: ParseSession['status']
}

/** Single constructor for export-ready ParseSession objects (interactive and batch). */
export function buildExportSession(params: BuildExportSessionParams): ParseSession {
  const confirmedPolicies =
    params.mode === 'batch'
      ? autoConfirmedPolicies(params.extraction)
      : (params.confirmedPolicies ?? [])

  const mismatches =
    params.mode === 'interactive'
      ? (params.mismatches ?? collectMismatches(params.extraction))
      : []

  const mismatchResolutions = params.mode === 'batch' ? [] : (params.mismatchResolutions ?? [])

  return {
    id: params.id,
    createdAt: params.createdAt ?? new Date().toISOString(),
    supplier: params.supplier,
    ratePDF: null,
    contractForm: null,
    extraction: params.extraction,
    confirmedPolicies,
    serviceMatches: params.serviceMatches,
    extrasMatches: params.extrasMatches,
    policyMatches: params.policyMatches,
    priorRates: params.priorRates,
    inventoryCounts: params.inventoryCounts ?? null,
    mismatches,
    mismatchResolutions,
    outputRows: [],
    extrasRows: [],
    validationFlags: [],
    step: params.step ?? (params.mode === 'batch' ? 6 : 5),
    status: params.status ?? (params.mode === 'batch' ? 'complete' : 'idle'),
  }
}

/** Validation flags when batch export skips interactive mismatch review. */
export function batchMismatchFlags(extraction: ExtractionResult): ValidationFlag[] {
  const mismatches = collectMismatches(extraction)
  if (mismatches.length === 0) return []

  return [
    {
      severity: 'info',
      code: 'BATCH_UNREVIEWED_MISMATCHES',
      message: `Batch export: ${mismatches.length} form/PDF discrepanc${mismatches.length === 1 ? 'y' : 'ies'} not reviewed interactively.`,
      details: mismatches
        .map((m) => `${m.section} / ${m.field}: form="${m.formValue}" vs pdf="${m.pdfValue}"`)
        .join('; '),
    },
  ]
}
