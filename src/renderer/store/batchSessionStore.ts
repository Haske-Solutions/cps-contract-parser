import { create } from 'zustand'
import type {
  CompletedSupplierExport,
  Supplier,
  SupplierMapping,
  SupplierWalkthroughContext,
} from '@shared/types'

interface BatchSessionState {
  anchorTerm: string
  peCatalog: Supplier[]
  mappings: SupplierMapping[]
  walkthrough: SupplierWalkthroughContext | null
  reviewedPeIds: number[]
  allSessionExports: CompletedSupplierExport[]
  setAnchorTerm: (term: string) => void
  setPeCatalog: (catalog: Supplier[]) => void
  setMappings: (mappings: SupplierMapping[]) => void
  setWalkthrough: (context: SupplierWalkthroughContext | null) => void
  addReviewedBatch: (peIds: number[], exports: CompletedSupplierExport[]) => void
  resetBatch: () => void
}

const initialState = {
  anchorTerm: '',
  peCatalog: [] as Supplier[],
  mappings: [] as SupplierMapping[],
  walkthrough: null as SupplierWalkthroughContext | null,
  reviewedPeIds: [] as number[],
  allSessionExports: [] as CompletedSupplierExport[],
}

export const useBatchSessionStore = create<BatchSessionState>((set) => ({
  ...initialState,
  setAnchorTerm: (anchorTerm) => set({ anchorTerm }),
  setPeCatalog: (peCatalog) => set({ peCatalog }),
  setMappings: (mappings) => set({ mappings }),
  setWalkthrough: (walkthrough) => set({ walkthrough }),
  addReviewedBatch: (peIds, exports) =>
    set((state) => {
      const reviewed = new Set(state.reviewedPeIds)
      for (const id of peIds) reviewed.add(id)
      return {
        reviewedPeIds: [...reviewed],
        allSessionExports: [...state.allSessionExports, ...exports],
      }
    }),
  resetBatch: () => set({ ...initialState }),
}))
