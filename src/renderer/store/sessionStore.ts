import { create } from 'zustand'
import type {
  ParseSession,
  Supplier,
  ExtractionResult,
  ConfirmedPolicy,
  ServiceMatch,
  PriorRate,
  Mismatch,
  MismatchResolution,
  RateRow,
  ExtrasRow,
  ValidationFlag,
  PEService,
} from '@shared/types'

interface SessionActions {
  setStep: (step: ParseSession['step']) => void
  setStatus: (status: ParseSession['status']) => void
  setRatePDF: (pdf: Uint8Array | null) => void
  setContractForm: (form: Uint8Array | null) => void
  setSupplier: (supplier: Supplier | null) => void
  setExtraction: (extraction: ExtractionResult | null) => void
  setConfirmedPolicies: (policies: ConfirmedPolicy[]) => void
  setServiceMatches: (matches: ServiceMatch[]) => void
  setExtrasMatches: (matches: ServiceMatch[]) => void
  setPolicyMatches: (matches: ServiceMatch[]) => void
  updateServiceMatch: (extractedName: string, candidate: PEService) => void
  updateExtrasMatch: (extractedName: string, candidate: PEService) => void
  updatePolicyMatch: (extractedName: string, candidate: PEService) => void
  setPriorRates: (rates: PriorRate[]) => void
  setMismatches: (mismatches: Mismatch[]) => void
  resolveMismatch: (field: string, resolution: MismatchResolution) => void
  setOutputRows: (rows: RateRow[]) => void
  setExtrasRows: (rows: ExtrasRow[]) => void
  setValidationFlags: (flags: ValidationFlag[]) => void
  resetSession: () => void
  resetSupplierWorkflow: () => void
  hydrateSession: (session: ParseSession) => void
}

function applyCandidateToMatch(match: ServiceMatch, candidate: PEService): ServiceMatch {
  return {
    ...match,
    peServiceId: candidate.id,
    peServiceName: candidate.name,
    peServiceCode: candidate.code,
    status: 'matched',
  }
}

function updateMatchList(
  matches: ServiceMatch[],
  extractedName: string,
  candidate: PEService,
): ServiceMatch[] {
  return matches.map((match) =>
    match.extractedName === extractedName ? applyCandidateToMatch(match, candidate) : match,
  )
}

const initialSession: ParseSession = {
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  supplier: null,
  ratePDF: null,
  contractForm: null,
  extraction: null,
  confirmedPolicies: [],
  serviceMatches: [],
  extrasMatches: [],
  policyMatches: [],
  priorRates: [],
  mismatches: [],
  mismatchResolutions: [],
  outputRows: [],
  extrasRows: [],
  validationFlags: [],
  step: 1,
  status: 'idle',
}

export const useSessionStore = create<ParseSession & SessionActions>((set) => ({
  ...initialSession,

  setStep: (step) => set({ step }),
  setStatus: (status) => set({ status }),
  setRatePDF: (ratePDF) => set({ ratePDF }),
  setContractForm: (contractForm) => set({ contractForm }),
  setSupplier: (supplier) => set({ supplier }),
  setExtraction: (extraction) => set({ extraction }),
  setConfirmedPolicies: (confirmedPolicies) => set({ confirmedPolicies }),
  setServiceMatches: (serviceMatches) => set({ serviceMatches }),
  setExtrasMatches: (extrasMatches) => set({ extrasMatches }),
  setPolicyMatches: (policyMatches) => set({ policyMatches }),

  updateServiceMatch: (extractedName, candidate) =>
    set((state) => ({
      serviceMatches: updateMatchList(state.serviceMatches, extractedName, candidate),
    })),

  updateExtrasMatch: (extractedName, candidate) =>
    set((state) => ({
      extrasMatches: updateMatchList(state.extrasMatches, extractedName, candidate),
    })),

  updatePolicyMatch: (extractedName, candidate) =>
    set((state) => ({
      policyMatches: updateMatchList(state.policyMatches, extractedName, candidate),
    })),

  setPriorRates: (priorRates) => set({ priorRates }),
  setMismatches: (mismatches) => set({ mismatches }),

  resolveMismatch: (field, resolution) =>
    set((state) => ({
      mismatches: state.mismatches.map((m) =>
        m.field === field
          ? { ...m, resolved: true, resolution: resolution.resolution, otherNote: resolution.otherNote }
          : m,
      ),
      mismatchResolutions: [
        ...state.mismatchResolutions.filter((r) => r.field !== field),
        resolution,
      ],
    })),

  setOutputRows: (outputRows) => set({ outputRows }),
  setExtrasRows: (extrasRows) => set({ extrasRows }),
  setValidationFlags: (validationFlags) => set({ validationFlags }),

  resetSession: () =>
    set({
      ...initialSession,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    }),

  resetSupplierWorkflow: () =>
    set({
      confirmedPolicies: [],
      serviceMatches: [],
      extrasMatches: [],
      policyMatches: [],
      priorRates: [],
      mismatches: [],
      mismatchResolutions: [],
      outputRows: [],
      extrasRows: [],
      validationFlags: [],
    }),

  hydrateSession: (session) => set({ ...session, policyMatches: session.policyMatches ?? [] }),
}))

export { applyCandidateToMatch, updateMatchList }
