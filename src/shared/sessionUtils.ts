import type { ParseSession } from './types'

/** Plain serializable snapshot for IPC — strips any non-data store fields. */
export function toExportSession(state: ParseSession): ParseSession {
  return {
    id: state.id,
    createdAt: state.createdAt,
    supplier: state.supplier,
    ratePDF: null,
    contractForm: null,
    extraction: state.extraction,
    confirmedPolicies: [...state.confirmedPolicies],
    serviceMatches: [...state.serviceMatches, ...state.policyMatches],
    extrasMatches: [...state.extrasMatches],
    policyMatches: [...state.policyMatches],
    priorRates: [...state.priorRates],
    inventoryCounts: state.inventoryCounts,
    mismatches: [...state.mismatches],
    mismatchResolutions: [...state.mismatchResolutions],
    outputRows: [...state.outputRows],
    extrasRows: [...state.extrasRows],
    validationFlags: [...state.validationFlags],
    step: state.step,
    status: state.status,
  }
}

export function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
}

/** Fresh copy for IPC — avoids stale store snapshots and detached ArrayBuffer views. */
export function copyPdfBytes(data: Uint8Array): Uint8Array {
  return new Uint8Array(data)
}

export function requireUploadedPdfs(
  ratePDF: Uint8Array | null | undefined,
  contractForm: Uint8Array | null | undefined,
): { ratePDF: Uint8Array; contractForm: Uint8Array } {
  if (!(ratePDF instanceof Uint8Array) || !(contractForm instanceof Uint8Array)) {
    throw new Error('Missing uploaded PDFs. Return to Step 1 and upload both documents.')
  }
  return {
    ratePDF: copyPdfBytes(ratePDF),
    contractForm: copyPdfBytes(contractForm),
  }
}
