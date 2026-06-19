// Shared TypeScript types for renderer ↔ main process communication.
// This file is the source of truth for all data shapes used across the app.

export interface Supplier {
  supplier_id: number
  name: string
  code: string
  destination_country: string
}

export interface ChildRate {
  ageFrom: number
  ageTo: number
  amount: number
  rateCode: string
}

export interface ExtractedRate {
  propertyName: string
  roomType: string
  mealBasis: string
  seasonName: string
  validFrom: string
  validTo: string
  rateAmount: number
  currency: string
  rateCode: string
  occupancyRules: string
  childRates: ChildRate[]
  singleSupplement: number | null
  notes: string
}

export interface ExtractedPolicy {
  type: 'CIOR' | 'children_sharing' | 'single_room' | 'free_child' | 'age_brackets' | 'triple_quad'
  verbatimText: string
  interpretation: string
  calculationApplied: string
  peServicesAffected: string[]
  confirmed: boolean
}

export interface ExtractionResult {
  supplierName: string
  peSupplierId?: number | null
  peSupplierCode?: string | null
  contractPeriod: { from: string; to: string }
  properties: string[]
  rates: ExtractedRate[]
  policies: ExtractedPolicy[]
}

export interface ExtractionBatchResult {
  suppliers: ExtractionResult[]
}

export type DetectionConfidence = 'high' | 'medium' | 'low'

export interface DetectedSupplier {
  extractedName: string
  properties: string[]
  confidence: DetectionConfidence
  sectionHint?: string
}

export interface SupplierDiscoveryResult {
  anchorTerm: string
  contractPeriod?: { from: string; to: string }
  detectedSuppliers: DetectedSupplier[]
}

export type MappingConfidence = DetectionConfidence | 'manual'

export type SupplierMatchStatus = 'matched' | 'unmatched_pdf' | 'unmatched_pe'

export interface SupplierMapping {
  peSupplier: Supplier | null
  detected: DetectedSupplier | null
  matchStatus: SupplierMatchStatus
  confidence: MappingConfidence
  /** True when this PDF property matches the uploaded contract form. */
  contractFormMatch: boolean
  included: boolean
  isPrimary: boolean
}

export interface PropertyMappingGroup {
  id: string
  parentName: string
  parentConfidence: DetectionConfidence
  mappings: SupplierMapping[]
}

export interface ExtractionMappingTarget {
  peSupplierId: number
  propertyLabel?: string
}

export type ExtractionProgressStatus = 'extracting' | 'cached'

export interface ExtractionProgress {
  current: number
  total: number
  peSupplierId: number
  supplierName: string
  status: ExtractionProgressStatus
}

export interface ExtractionPropertyComplete {
  peSupplierId: number
  extraction: ExtractionResult
  completed: number
  total: number
}

export interface BatchSessionContext {
  anchorTerm: string
  mappings: SupplierMapping[]
  primaryPeId: number
  batchPeIds: number[]
  extractionsByPeId: Record<number, ExtractionResult>
}

export interface CompletedSupplierExport {
  supplierId: number
  supplierName: string
  supplierCode: string
  filename: string
  buffer: Uint8Array
  rateRowCount: number
  validationFlagCount: number
}

export interface SupplierWalkthroughContext {
  anchorTerm: string
  queue: SupplierMapping[]
  currentIndex: number
  extractionsByPeId: Record<number, ExtractionResult>
  completedExports: CompletedSupplierExport[]
  status: 'in_progress' | 'complete'
}

export interface BatchExportSummary {
  supplierId: number
  supplierName: string
  supplierCode: string
  success: boolean
  rateRowCount: number
  validationFlagCount: number
  error?: string
}

export interface BatchZipResult {
  zipBuffer: Uint8Array
  summaries: BatchExportSummary[]
}

export interface PEService {
  id: number
  name: string
  code: string
}

export interface ServiceMatch {
  extractedName: string
  peServiceId: number | null
  peServiceName: string | null
  peServiceCode: string | null
  status: 'matched' | 'needs_creation' | 'multiple_matches'
  candidates: PEService[]
}

export interface PriorRate {
  serviceName: string
  adultCost: number
  childCost: number
  rateType: string
  currency: string
  logTimestamp: string
  percentChange: number | null
}

export interface Mismatch {
  field: string
  formValue: string
  pdfValue: string
  resolved: boolean
  resolution: 'use_form' | 'use_pdf' | 'other' | null
  otherNote: string | null
}

export interface MismatchResolution {
  field: string
  chosenValue: string
  resolution: 'use_form' | 'use_pdf' | 'other'
  otherNote: string | null
}

export interface ConfirmedPolicy {
  type: ExtractedPolicy['type']
  confirmed: boolean
}

export interface RateRow {
  supplierName: string
  supplierId: number
  supplierCode: string
  service: string
  serviceId: number
  serviceCode: string
  validFrom: string
  validTo: string
  agentGroupId: 0
  rateCode: string
  rateName: string
  ratePlan: string
  currencyBuy: 'USD'
  currencySell: 'USD'
  adultBuy: number
  adultSell: number
  childCost: number
  childSell: number
  markup: 0
  minPax: number
  maxPax: number
  minStay: number
  maxStay: number
  api: true
  isActive: true
  isException: boolean
}

export interface ExtrasRow {
  supplierName: string
  supplierId: number
  supplierCode: string
  service: string
  serviceId: number
  serviceCode: string
  validFrom: string
  validTo: string
  agentGroupId: 0
  rateCode: string
  rateName: string
  currencyBuy: 'USD'
  currencySell: 'USD'
  adultBuy: number
  adultSell: number
  childCost: number
  childSell: number
  markup: 0
  minPax: number
  maxPax: number
  minStay: number
  maxStay: number
  api: true
  isActive: true
  isException: boolean
  extraCategory: string
  priceType: 'per_person' | 'per_unit'
}

export type ValidationSeverity = 'stop' | 'needs_creation' | 'rate_change' | 'info'

export interface ValidationFlag {
  severity: ValidationSeverity
  code: string
  message: string
  affectedService?: string
  details?: string
}

export interface ParseSession {
  id: string
  createdAt: string
  supplier: Supplier | null
  ratePDF: Uint8Array | null
  contractForm: Uint8Array | null
  extraction: ExtractionResult | null
  confirmedPolicies: ConfirmedPolicy[]
  serviceMatches: ServiceMatch[]
  extrasMatches: ServiceMatch[]
  policyMatches: ServiceMatch[]
  priorRates: PriorRate[]
  mismatches: Mismatch[]
  mismatchResolutions: MismatchResolution[]
  outputRows: RateRow[]
  extrasRows: ExtrasRow[]
  validationFlags: ValidationFlag[]
  step: 1 | 2 | 3 | 4 | 5 | 6
  status:
    | 'idle'
    | 'loading'
    | 'awaiting_supplier_mapping'
    | 'awaiting_supplier_selection'
    | 'awaiting_confirmation'
    | 'awaiting_mismatch'
    | 'complete'
    | 'blocked'
}

export interface ExcelResult {
  buffer: ArrayBuffer | Uint8Array
  rateRows: RateRow[]
  extrasRows: ExtrasRow[]
  flags: ValidationFlag[]
}

export interface HistorySession {
  id: string
  createdAt: string
  supplierName: string
  status: 'complete' | 'blocked' | 'in_progress'
  validationFlagCount: number
  hasExcel: boolean
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface MotherduckTokenPreview {
  masked: string
  fingerprint: string
  source: 'keychain' | 'env'
  savedAt: string | null
  canRemove: boolean
  database: string
}

export interface ParserApiKeyPreview {
  masked: string
  fingerprint: string
  source: 'keychain' | 'env'
  savedAt: string | null
  canRemove: boolean
  proxyUrl: string | null
}

export interface ElectronAPI {
  file: {
    saveExcel: (buffer: ArrayBuffer, defaultName: string) => Promise<string | null>
  }
  parser: {
    extractRates: (
      ratePDF: Uint8Array,
      contractForm: Uint8Array,
      options?: { peCatalog?: Supplier[]; targetPeSupplierId?: number },
    ) => Promise<ExtractionBatchResult>
    discoverSuppliers: (
      ratePDF: Uint8Array,
      contractForm: Uint8Array,
      peCatalog: Supplier[],
      anchorTerm: string,
    ) => Promise<SupplierDiscoveryResult>
    extractRatesForMappings: (
      ratePDF: Uint8Array,
      contractForm: Uint8Array,
      peCatalog: Supplier[],
      targets: ExtractionMappingTarget[],
    ) => Promise<Record<number, ExtractionResult>>
    onExtractionProgress: (callback: (progress: ExtractionProgress) => void) => () => void
    onExtractionPropertyComplete: (
      callback: (payload: ExtractionPropertyComplete) => void,
    ) => () => void
    confirmPolicies: (sessionId: string, policies: ConfirmedPolicy[]) => Promise<void>
  }
  warehouse: {
    supplierLookup: (name: string) => Promise<Supplier[]>
    supplierLookupFromFilenames: (
      contractFormFilename: string,
      rateSheetFilename: string,
    ) => Promise<Supplier[]>
    accommodationSupplierCatalog: (anchorTerm: string) => Promise<Supplier[]>
    accommodationSupplierCatalogForTerms: (anchorTerms: string[]) => Promise<Supplier[]>
    serviceMatch: (supplierId: number) => Promise<ServiceMatch[]>
    extrasMatch: (supplierId: number) => Promise<ServiceMatch[]>
    policyServiceMatch: (supplierId: number) => Promise<ServiceMatch[]>
    priorRates: (supplierId: number, servicePattern: string) => Promise<PriorRate[]>
  }
  export: {
    generateExcel: (session: ParseSession) => Promise<ExcelResult>
    buildWorkbook: (
      rateRows: RateRow[],
      extrasRows: ExtrasRow[],
      flags: ValidationFlag[],
    ) => Promise<{ buffer: Uint8Array }>
    generateBatchZip: (
      context: BatchSessionContext,
      ratePDF: Uint8Array,
      contractForm: Uint8Array,
      sessionId: string,
    ) => Promise<BatchZipResult>
    saveZip: (buffer: ArrayBuffer, defaultName: string) => Promise<string | null>
    zipBuffers: (
      entries: Array<{ filename: string; buffer: Uint8Array }>,
    ) => Promise<Uint8Array>
  }
  settings: {
    getAwsRegion: () => Promise<string>
    setAwsRegion: (region: string) => Promise<void>
    getAwsProfile: () => Promise<string>
    setAwsProfile: (profile: string) => Promise<void>
    getMotherduckCredentials: () => Promise<boolean>
    getMotherduckTokenPreview: () => Promise<MotherduckTokenPreview | null>
    setMotherduckToken: (token: string) => Promise<void>
    deleteMotherduckToken: () => Promise<void>
    testConnection: () => Promise<{ ok: boolean; message: string }>
    getParserProxyUrl: () => Promise<string>
    setParserProxyUrl: (url: string) => Promise<void>
    getParserApiKeyPreview: () => Promise<ParserApiKeyPreview | null>
    setParserApiKey: (apiKey: string) => Promise<void>
    deleteParserApiKey: () => Promise<void>
    testParserConnection: () => Promise<{ ok: boolean; message: string }>
  }
  dialog: {
    openFile: (filters: FileFilter[]) => Promise<string | null>
    saveFile: (defaultName: string) => Promise<string | null>
  }
  history: {
    list: () => Promise<HistorySession[]>
    getSession: (id: string) => Promise<ParseSession | null>
    deleteSession: (id: string) => Promise<void>
    clearAll: () => Promise<void>
  }
  renderer: {
    reportError: (detail: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
