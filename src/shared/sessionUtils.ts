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
