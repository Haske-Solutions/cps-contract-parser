import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseExtraction, extractionWithCrossChecks, mockSupplier, buildSession } from './fixtures'
import type { BatchSessionContext } from '../shared/types'

vi.mock('../main/services/warehouseService', () => ({
  serviceMatch: vi.fn(),
  extrasMatch: vi.fn(),
  policyServiceMatch: vi.fn(),
  priorRates: vi.fn(),
}))

vi.mock('../main/services/historyService', () => ({
  saveSession: vi.fn(),
}))

import {
  serviceMatch,
  extrasMatch,
  policyServiceMatch,
  priorRates,
} from '../main/services/warehouseService'
import { generateBatchZip, zipBufferEntries } from '../main/services/batchExportService'

const mockServiceMatch = vi.mocked(serviceMatch)
const mockExtrasMatch = vi.mocked(extrasMatch)
const mockPolicyServiceMatch = vi.mocked(policyServiceMatch)
const mockPriorRates = vi.mocked(priorRates)

describe('generateBatchZip', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServiceMatch.mockResolvedValue([
      {
        ...buildSession().serviceMatches[0]!,
        peServiceName: 'FB Double Deluxe',
      },
    ])
    mockExtrasMatch.mockResolvedValue([])
    mockPolicyServiceMatch.mockResolvedValue([])
    mockPriorRates.mockResolvedValue([])
  })

  it('produces a ZIP buffer with summaries for batch suppliers', async () => {
    const batchSupplier = { ...mockSupplier, supplier_id: 99, name: 'Loisaba', code: 'LB01' }
    const context: BatchSessionContext = {
      anchorTerm: 'Elewana',
      mappings: [
        {
          peSupplier: batchSupplier,
          detected: null,
          matchStatus: 'matched',
          confidence: 'high',
          contractFormMatch: true,
          included: true,
          isPrimary: false,
        },
      ],
      primaryPeId: mockSupplier.supplier_id,
      batchPeIds: [99],
      extractionsByPeId: {
        99: { ...baseExtraction, supplierName: 'Loisaba' },
      },
    }

    const { zipBuffer, summaries } = await generateBatchZip(context, 'session-1')

    expect(zipBuffer.length).toBeGreaterThan(0)
    expect(summaries).toHaveLength(1)
    expect(summaries[0]?.success).toBe(true)
    expect(summaries[0]?.supplierId).toBe(99)
    expect(summaries[0]?.rateRowCount).toBeGreaterThan(0)
  })

  it('adds batch mismatch warning flags when cross-checks exist', async () => {
    const batchSupplier = { ...mockSupplier, supplier_id: 99, name: 'Loisaba', code: 'LB01' }
    const context: BatchSessionContext = {
      anchorTerm: 'Elewana',
      mappings: [
        {
          peSupplier: batchSupplier,
          detected: null,
          matchStatus: 'matched',
          confidence: 'high',
          contractFormMatch: true,
          included: true,
          isPrimary: false,
        },
      ],
      primaryPeId: mockSupplier.supplier_id,
      batchPeIds: [99],
      extractionsByPeId: {
        99: { ...extractionWithCrossChecks, supplierName: 'Loisaba' },
      },
    }

    const { summaries } = await generateBatchZip(context, 'session-1')

    expect(summaries[0]?.success).toBe(true)
    expect(summaries[0]?.validationFlagCount).toBeGreaterThan(0)
  })

  it('reports failure when extraction is missing for a batch supplier', async () => {
    const context: BatchSessionContext = {
      anchorTerm: 'Elewana',
      mappings: [],
      primaryPeId: 1,
      batchPeIds: [99],
      extractionsByPeId: {},
    }

    const { summaries } = await generateBatchZip(context, 'session-1')

    expect(summaries[0]?.success).toBe(false)
    expect(summaries[0]?.error).toMatch(/Missing supplier/i)
  })
})

describe('zipBufferEntries', () => {
  it('packages multiple workbook buffers into a ZIP archive', async () => {
    const zipBuffer = await zipBufferEntries([
      { filename: 'CPS_A_rates.xlsx', buffer: new Uint8Array([1, 2, 3]) },
      { filename: 'CPS_B_rates.xlsx', buffer: new Uint8Array([4, 5, 6]) },
    ])

    expect(zipBuffer.length).toBeGreaterThan(0)
  })
})
