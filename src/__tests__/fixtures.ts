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
import { rateRecordKey } from '../shared/serviceTokenMatcher'

export const mockSupplier: Supplier = {
  supplier_id: 42,
  name: 'Savanna Lodge',
  code: 'SL001',
  destination_country: 'KE',
}

export const mockExtractedRate: ExtractedRate = {
  propertyName: 'Savanna Lodge',
  roomType: 'Deluxe Double',
  mealBasis: 'FB',
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

const _rateKey = rateRecordKey(mockExtractedRate)

export const mockServiceMatch: ServiceMatch = {
  extractedName: _rateKey,
  peServiceId: 101,
  peServiceName: 'FB Double Deluxe',
  peServiceCode: 'DD001',
  status: 'matched',
  candidates: [],
  bucket: 'accommodation',
  rateRecordKey: _rateKey,
}

export const mockExtrasMatch: ServiceMatch = {
  extractedName: 'Laundry',
  peServiceId: 201,
  peServiceName: 'Laundry',
  peServiceCode: 'EX001',
  status: 'matched',
  candidates: [],
  bucket: 'extras',
}

export const mockCiorPolicy: ExtractedPolicy = {
  type: 'CIOR',
  verbatimText: 'Children in own room free of charge',
  interpretation: 'CIOR policy applies — child pays no adult rate',
  calculationApplied: '75% of PPS adult rate',
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
    inventoryCounts: null,
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
  serviceName: 'FB Double Deluxe',
  adultCost: 300,
  childCost: 150,
  rateType: 'DBL',
  currency: 'USD',
  logTimestamp: '2025-01-15T10:00:00Z',
  percentChange: null,
}

export const mockMismatchResolution: MismatchResolution = {
  id: 'mismatch-1',
  field: 'validFrom',
  chosenValue: '2026-02-01',
  resolution: 'use_form',
  otherNote: null,
}

export const mockConfirmedCior: ConfirmedPolicy = {
  type: 'CIOR',
  confirmed: true,
}

export const mockPeServices = [
  { id: 101, name: 'FB Double Deluxe', code: 'DD001' },
  { id: 102, name: 'Full Board Double Safari Tent', code: 'DT002' },
  { id: 103, name: 'HB Twin Cottage', code: 'TC003' },
  { id: 104, name: 'Full Board Double Suite', code: 'DS004' },
]

export const extractionWithCrossChecks: ExtractionResult = {
  ...baseExtraction,
  crossChecks: [
    {
      id: 'cc-1',
      section: 'Rates',
      field: 'Adult Buy',
      formValue: '350',
      pdfValue: '360',
      rateRef: 'Deluxe Double',
    },
  ],
}

export const extractionWithNonAccom: ExtractionResult = {
  ...baseExtraction,
  nonAccommodationRates: [
    {
      description: 'Airport Transfer',
      rateTypeCode: 'PV',
      cost: 120,
      sell: 120,
      released: true,
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      notes: '',
    },
  ],
}
