import { createHash } from 'crypto'
import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { ExtractionResult } from '../../shared/types'
import { logger } from './logger'

const CACHE_VERSION = 1

interface CachedExtractionEntry {
  version: number
  cachedAt: string
  pdfHash: string
  peSupplierId: number
  extraction: ExtractionResult
}

let cacheRootOverride: string | null = null

/** Test hook — override cache directory (pass null to reset). */
export function setExtractionCacheRootForTests(root: string | null): void {
  cacheRootOverride = root
}

function cacheDir(): string {
  const root = cacheRootOverride ?? path.join(app.getPath('userData'), 'extraction-cache')
  fs.mkdirSync(root, { recursive: true })
  return root
}

export function hashPdfPair(ratePDF: Uint8Array, contractForm: Uint8Array): string {
  const hash = createHash('sha256')
  hash.update(ratePDF)
  hash.update(contractForm)
  return hash.digest('hex')
}

function cacheFilePath(pdfHash: string, peSupplierId: number): string {
  return path.join(cacheDir(), `${pdfHash}_${peSupplierId}.json`)
}

export async function getCachedExtraction(
  pdfHash: string,
  peSupplierId: number,
): Promise<ExtractionResult | null> {
  const filePath = cacheFilePath(pdfHash, peSupplierId)
  if (!fs.existsSync(filePath)) return null

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CachedExtractionEntry
    if (raw.version !== CACHE_VERSION || raw.pdfHash !== pdfHash || raw.peSupplierId !== peSupplierId) {
      return null
    }
    return raw.extraction
  } catch (err) {
    logger.warn('extractionCache', `Ignoring corrupt cache entry ${filePath}`, err)
    return null
  }
}

export async function setCachedExtraction(
  pdfHash: string,
  peSupplierId: number,
  extraction: ExtractionResult,
): Promise<void> {
  const entry: CachedExtractionEntry = {
    version: CACHE_VERSION,
    cachedAt: new Date().toISOString(),
    pdfHash,
    peSupplierId,
    extraction,
  }
  const filePath = cacheFilePath(pdfHash, peSupplierId)
  await fs.promises.writeFile(filePath, JSON.stringify(entry), 'utf-8')
}
