import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/cps-test-user-data'),
  },
}))

import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { baseExtraction } from './fixtures'
import {
  getCachedExtraction,
  hashPdfPair,
  setCachedExtraction,
  setExtractionCacheRootForTests,
} from '../main/services/extractionCacheService'

describe('extractionCacheService', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cps-extraction-cache-'))
    setExtractionCacheRootForTests(tempDir)
  })

  afterEach(() => {
    setExtractionCacheRootForTests(null)
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('hashPdfPair is stable for the same PDF bytes', () => {
    const rate = new Uint8Array([1, 2, 3])
    const form = new Uint8Array([4, 5])
    expect(hashPdfPair(rate, form)).toBe(hashPdfPair(rate, form))
    expect(hashPdfPair(rate, form)).not.toBe(hashPdfPair(new Uint8Array([9]), form))
  })

  it('stores and retrieves extraction results by pdf hash and PE id', async () => {
    const hash = hashPdfPair(new Uint8Array([1]), new Uint8Array([2]))
    const extraction = { ...baseExtraction, peSupplierId: 7 }

    expect(await getCachedExtraction(hash, 7)).toBeNull()

    await setCachedExtraction(hash, 7, extraction)

    const cached = await getCachedExtraction(hash, 7)
    expect(cached?.supplierName).toBe(baseExtraction.supplierName)
    expect(cached?.peSupplierId).toBe(7)
  })

  it('does not return cache entries for a different pdf hash', async () => {
    const hashA = hashPdfPair(new Uint8Array([1]), new Uint8Array([2]))
    const hashB = hashPdfPair(new Uint8Array([3]), new Uint8Array([2]))

    await setCachedExtraction(hashA, 7, { ...baseExtraction, peSupplierId: 7 })

    expect(await getCachedExtraction(hashB, 7)).toBeNull()
  })
})
