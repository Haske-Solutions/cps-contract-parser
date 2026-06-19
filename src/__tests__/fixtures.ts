import type {
  ParseSession,
  Supplier,
  ExtractionResult,
  ExtractedRate,
  ExtractedPolicy,
  ServiceMatch,
  PriorRate,
  ConfirmedPolicy,
  MismatchResolution,
} from '../shared/types'

export const mockSupplier: Supplier = {
  supplier_id: 42,
  name: 'Savanna Lodge',
  code: 'SL001',
  destination_country: 'KE',
}

export const mockServiceMatch: ServiceMatch = {
  extractedName: 'Deluxe Double',
  peServiceId: 101,
  peServiceName: 'Deluxe Double',
  peServiceCode: 'DD001',
  status: 'matched',
  candidates: [],
}

export const mockExtrasMatch: ServiceMatch = {
  extractedName: 'Laundry',
  peServiceId: 201,
  peServiceName: 'Laundry',
  peServiceCode: 'EX001',
  status: 'matched',
  candidates: [],
}

export const mockExtractedRate: ExtractedRate = {
  propertyName: 'Savanna Lodge',
  roomType: 'Deluxe Double',
  mealBasis: 'Full Board',
  seasonName: 'Peak Season',
  validFrom: '2026-01-01',
  validTo: '2026-03-31',
  rateAmount: 350,
  currency: 'USD',
  rateCode: 'DBL',
  occupancyRules: '2 adults',
  childRates: [{ ageFrom: 0, ageTo: 12, amount: 175, rateCode: 'CHD' }],
  singleSupplement: null,
  notes: '',
}

export const mockCiorPolicy: ExtractedPolicy = {
  type: 'CIOR',
  verbatimText: 'Children in own room free of charge',
  interpretation: 'CIOR policy applies — child pays no adult rate',
  calculationApplied: 'adultBuy = 0',
  peServicesAffected: [],
  confirmed: false,
}

export const baseExtraction: ExtractionResult = {
  supplierName: 'Savanna Lodge',
  contractPeriod: { from: '2026-01-01', to: '2026-12-31' },
  properties: ['Savanna Lodge'],
  rates: [mockExtractedRate],
  policies: [],
}

export function buildSession(overrides: Partial<ParseSession> = {}): ParseSession {
  return {
    id: 'test-session-id',
    createdAt: '2026-01-01T00:00:00.000Z',
    supplier: mockSupplier,
    ratePDF: null,
    contractForm: null,
    extraction: baseExtraction,
    confirmedPolicies: [],
    serviceMatches: [mockServiceMatch],
    extrasMatches: [],
    policyMatches: [],
    priorRates: [],
    mismatches: [],
    mismatchResolutions: [],
    outputRows: [],
    extrasRows: [],
    validationFlags: [],
    step: 5,
    status: 'idle',
    ...overrides,
  }
}

export const mockPriorRate: PriorRate = {
  serviceName: 'Deluxe Double',
  adultCost: 300,
  childCost: 150,
  rateType: 'DBL',
  currency: 'USD',
  logTimestamp: '2025-01-15T10:00:00Z',
  percentChange: null,
}

export const mockMismatchResolution: MismatchResolution = {
  field: 'validFrom',
  chosenValue: '2026-02-01',
  resolution: 'use_form',
  otherNote: null,
}

export const mockConfirmedCior: ConfirmedPolicy = {
  type: 'CIOR',
  confirmed: true,
}
