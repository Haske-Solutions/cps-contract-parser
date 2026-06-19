import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseClaudeResponseText, extractRates, extractRatesForMappings } from '../main/services/parserService'
import { baseExtraction } from './fixtures'

const mockSend = vi.fn()

vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeModelCommand: vi.fn().mockImplementation((input: unknown) => input),
}))

vi.mock('../main/services/keystoreService', () => ({
  getAwsRegion: () => 'us-east-1',
  getAwsProfile: () => '',
}))

vi.mock('../main/services/parserProxyClient', () => ({
  resolveParserProxyConfig: vi.fn().mockResolvedValue(null),
  discoverViaProxy: vi.fn(),
  extractViaProxy: vi.fn(),
  testParserProxyConnection: vi.fn(),
}))

vi.mock('../main/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getLogDirectory: () => '/tmp/cps-test-logs',
  },
}))

const mockGetCachedExtraction = vi.fn()
const mockSetCachedExtraction = vi.fn()

vi.mock('../main/services/extractionCacheService', () => ({
  hashPdfPair: vi.fn(() => 'test-pdf-hash'),
  getCachedExtraction: (...args: unknown[]) => mockGetCachedExtraction(...args),
  setCachedExtraction: (...args: unknown[]) => mockSetCachedExtraction(...args),
}))

function bedrockBody(extraction: unknown) {
  return new TextEncoder().encode(
    JSON.stringify({
      content: [{ type: 'text', text: JSON.stringify(extraction) }],
      stop_reason: 'end_turn',
    }),
  )
}

describe('parseClaudeResponseText', () => {
  it('parses fenced JSON responses', () => {
    const parsed = parseClaudeResponseText(
      '```json\n' + JSON.stringify(baseExtraction) + '\n```',
    ) as typeof baseExtraction
    expect(parsed.supplierName).toBe(baseExtraction.supplierName)
  })

  it('parses JSON embedded in markdown preamble', () => {
    const parsed = parseClaudeResponseText(
      'Here is the extracted contract data:\n\n```json\n' +
        JSON.stringify(baseExtraction) +
        '\n```\n\nLet me know if you need changes.',
    ) as typeof baseExtraction
    expect(parsed.supplierName).toBe(baseExtraction.supplierName)
  })

  it('parses raw JSON objects surrounded by prose', () => {
    const parsed = parseClaudeResponseText(
      'Extraction complete.\n' + JSON.stringify(baseExtraction) + '\nDone.',
    ) as typeof baseExtraction
    expect(parsed.supplierName).toBe(baseExtraction.supplierName)
  })

  it('throws a truncation-specific error when stop_reason is max_tokens', () => {
    expect(() => parseClaudeResponseText('{"supplierName": "partial', 'max_tokens')).toThrow(
      /truncated/i,
    )
  })

  it('throws a friendly error for invalid JSON', () => {
    expect(() => parseClaudeResponseText('not-json')).toThrow(/could not be parsed/i)
  })
})

describe('extractRates', () => {
  beforeEach(() => {
    mockSend.mockReset()
  })

  it('returns a normalized ExtractionBatchResult from a mocked Bedrock response', async () => {
    mockSend.mockResolvedValueOnce({
      body: bedrockBody({ suppliers: [baseExtraction] }),
    })

    const result = await extractRates(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]))

    expect(result.suppliers).toHaveLength(1)
    expect(result.suppliers[0]?.supplierName).toBe(baseExtraction.supplierName)
    expect(result.suppliers[0]?.rates[0]?.rateCode).toBe('DBL')
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('still normalizes legacy single-supplier responses', async () => {
    mockSend.mockResolvedValueOnce({ body: bedrockBody(baseExtraction) })

    const result = await extractRates(new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6]))

    expect(result.suppliers).toHaveLength(1)
    expect(result.suppliers[0]?.supplierName).toBe(baseExtraction.supplierName)
  })

  it('enforces precondition P1 when PDF bytes are missing', async () => {
    await expect(extractRates(new Uint8Array(), new Uint8Array([1]))).rejects.toThrow(/P1/i)
    await expect(extractRates(new Uint8Array([1]), new Uint8Array())).rejects.toThrow(/P1/i)
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('maps Bedrock auth failures to a user-friendly message', async () => {
    mockSend.mockRejectedValueOnce(new Error('AccessDeniedException: not authorized'))

    await expect(extractRates(new Uint8Array([1]), new Uint8Array([2]))).rejects.toThrow(
      /authenticate with Amazon Bedrock/i,
    )
  })

  it('retries Bedrock throttling before surfacing a friendly error', async () => {
    vi.useFakeTimers()
    mockSend.mockRejectedValue(new Error('ThrottlingException: rate exceeded'))

    const extraction = extractRates(new Uint8Array([1]), new Uint8Array([2]))
    const assertion = expect(extraction).rejects.toThrow(/temporarily busy/i)
    await vi.runAllTimersAsync()
    await assertion
    expect(mockSend.mock.calls.length).toBeGreaterThan(1)
    vi.useRealTimers()
  })
})

describe('extractRatesForMappings', () => {
  beforeEach(() => {
    mockSend.mockReset()
    mockGetCachedExtraction.mockReset()
    mockSetCachedExtraction.mockReset()
    mockGetCachedExtraction.mockResolvedValue(null)
    mockSetCachedExtraction.mockResolvedValue(undefined)
  })

  it('extracts each target supplier individually instead of one bulk call', async () => {
    const makeExtraction = (id: number, name: string) => ({
      ...baseExtraction,
      supplierName: name,
      peSupplierId: id,
      peSupplierCode: `C${id}`,
    })

    mockSend
      .mockResolvedValueOnce({
        body: bedrockBody({ suppliers: [makeExtraction(1, 'Camp A')] }),
      })
      .mockResolvedValueOnce({
        body: bedrockBody({ suppliers: [makeExtraction(2, 'Camp B')] }),
      })

    const peCatalog = [
      { supplier_id: 1, name: 'Camp A', code: 'C1', destination_country: 'KE' },
      { supplier_id: 2, name: 'Camp B', code: 'C2', destination_country: 'KE' },
    ]

    const result = await extractRatesForMappings(
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      peCatalog,
      [
        { peSupplierId: 1, propertyLabel: 'Camp A' },
        { peSupplierId: 2, propertyLabel: 'Camp B' },
      ],
    )

    expect(mockSend).toHaveBeenCalledTimes(2)
    expect(result[1]?.supplierName).toBe('Camp A')
    expect(result[2]?.supplierName).toBe('Camp B')
  })

  it('uses cached extraction without calling Bedrock', async () => {
    const cached = { ...baseExtraction, peSupplierId: 1, supplierName: 'Cached Camp' }
    mockGetCachedExtraction.mockResolvedValueOnce(cached)

    const peCatalog = [
      { supplier_id: 1, name: 'Camp A', code: 'C1', destination_country: 'KE' },
    ]

    const progress: import('../main/services/parserService').ExtractionProgress[] = []
    const result = await extractRatesForMappings(
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
      peCatalog,
      [{ peSupplierId: 1, propertyLabel: 'Camp A' }],
      (event) => progress.push(event),
    )

    expect(mockSend).not.toHaveBeenCalled()
    expect(result[1]?.supplierName).toBe('Cached Camp')
    expect(progress).toEqual([
      expect.objectContaining({ current: 1, total: 1, status: 'cached', supplierName: 'Camp A' }),
    ])
  })

  it('reports extracting progress for each Bedrock call', async () => {
    mockSend.mockResolvedValueOnce({
      body: bedrockBody({ suppliers: [{ ...baseExtraction, peSupplierId: 1 }] }),
    })

    const progress: import('../main/services/parserService').ExtractionProgress[] = []
    await extractRatesForMappings(
      new Uint8Array([1]),
      new Uint8Array([2]),
      [{ supplier_id: 1, name: 'Camp A', code: 'C1', destination_country: 'KE' }],
      [{ peSupplierId: 1 }],
      (event) => progress.push(event),
    )

    expect(progress).toEqual([
      expect.objectContaining({ total: 1, status: 'extracting', supplierName: 'Camp A' }),
    ])
    expect(mockSetCachedExtraction).toHaveBeenCalledOnce()
  })

  it('fires onPropertyComplete for each extracted property', async () => {
    mockSend
      .mockResolvedValueOnce({
        body: bedrockBody({ suppliers: [{ ...baseExtraction, peSupplierId: 1, supplierName: 'Camp A' }] }),
      })
      .mockResolvedValueOnce({
        body: bedrockBody({ suppliers: [{ ...baseExtraction, peSupplierId: 2, supplierName: 'Camp B' }] }),
      })

    const peCatalog = [
      { supplier_id: 1, name: 'Camp A', code: 'C1', destination_country: 'KE' },
      { supplier_id: 2, name: 'Camp B', code: 'C2', destination_country: 'KE' },
    ]

    const completed: import('../main/services/parserService').ExtractionPropertyComplete[] = []
    await extractRatesForMappings(
      new Uint8Array([1]),
      new Uint8Array([2]),
      peCatalog,
      [{ peSupplierId: 1 }, { peSupplierId: 2 }],
      undefined,
      (payload) => completed.push(payload),
    )

    expect(completed).toHaveLength(2)
    expect(completed.map((c) => c.peSupplierId).sort()).toEqual([1, 2])
    expect(completed.every((c) => c.total === 2)).toBe(true)
  })

  it('fires onPropertyComplete for cache hits without calling Bedrock', async () => {
    const cached = { ...baseExtraction, peSupplierId: 1, supplierName: 'Cached Camp' }
    mockGetCachedExtraction.mockResolvedValueOnce(cached)

    const completed: import('../main/services/parserService').ExtractionPropertyComplete[] = []
    await extractRatesForMappings(
      new Uint8Array([1]),
      new Uint8Array([2]),
      [{ supplier_id: 1, name: 'Camp A', code: 'C1', destination_country: 'KE' }],
      [{ peSupplierId: 1 }],
      undefined,
      (payload) => completed.push(payload),
    )

    expect(mockSend).not.toHaveBeenCalled()
    expect(completed).toEqual([
      expect.objectContaining({
        peSupplierId: 1,
        completed: 1,
        total: 1,
        extraction: expect.objectContaining({ supplierName: 'Cached Camp' }),
      }),
    ])
  })

  it('limits concurrent Bedrock calls to MAX_CONCURRENT_EXTRACTIONS', async () => {
    vi.useFakeTimers()
    let inFlight = 0
    let maxInFlight = 0

    mockSend.mockImplementation(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 100))
      inFlight--
      return {
        body: bedrockBody({
          suppliers: [{ ...baseExtraction, peSupplierId: inFlight, supplierName: 'Camp' }],
        }),
      }
    })

    const peCatalog = Array.from({ length: 4 }, (_, i) => ({
      supplier_id: i + 1,
      name: `Camp ${i + 1}`,
      code: `C${i + 1}`,
      destination_country: 'KE',
    }))

    const extraction = extractRatesForMappings(
      new Uint8Array([1]),
      new Uint8Array([2]),
      peCatalog,
      peCatalog.map((s) => ({ peSupplierId: s.supplier_id })),
    )

    await vi.runAllTimersAsync()
    await extraction

    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(mockSend).toHaveBeenCalledTimes(4)
    vi.useRealTimers()
  })

  it('rejects more than MAX_PROPERTIES_PER_RUN targets', async () => {
    const peCatalog = Array.from({ length: 6 }, (_, i) => ({
      supplier_id: i + 1,
      name: `Camp ${i + 1}`,
      code: `C${i + 1}`,
      destination_country: 'KE',
    }))

    await expect(
      extractRatesForMappings(
        new Uint8Array([1]),
        new Uint8Array([2]),
        peCatalog,
        peCatalog.map((s) => ({ peSupplierId: s.supplier_id })),
      ),
    ).rejects.toThrow(/at most 5 properties/i)
  })
})
