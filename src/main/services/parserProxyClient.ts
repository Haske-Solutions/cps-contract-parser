import { randomUUID } from 'crypto'
import type {
  ExtractionBatchResult,
  Supplier,
  SupplierDiscoveryResult,
} from '../../shared/types'
import {
  uint8ArrayToBase64,
  type ExtractRatesOptions,
} from '../../shared/parserInvoke'
import {
  PARSER_RETRY_BASE_DELAY_MS,
  PARSER_RETRY_MAX_ATTEMPTS,
  PARSER_RETRY_MAX_DELAY_MS,
} from '../../shared/constants'
import {
  isRetryableHttpStatus,
  isRetryableParserError,
  isTransientNetworkError,
  withRetry,
} from '../../shared/retry'
import {
  getParserProxyUrl,
  resolveParserApiKey,
} from './keystoreService'
import { logger } from './logger'

const PROXY_TIMEOUT_MS = 10 * 60 * 1000

export interface ParserProxyConfig {
  url: string
  apiKey: string
}

export async function resolveParserProxyConfig(): Promise<ParserProxyConfig | null> {
  const url = getParserProxyUrl()
  if (!url) return null

  const apiKey = await resolveParserApiKey()
  if (!apiKey) {
    throw new Error(
      'Parser API URL is configured but no API key was found. Save a Parser API key in Settings.',
    )
  }

  return { url: normalizeProxyUrl(url), apiKey }
}

export function normalizeProxyUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return ''

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    throw new Error('Parser API URL is not a valid URL.')
  }

  const isLocal =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '[::1]'

  if (parsed.protocol !== 'https:' && !isLocal) {
    throw new Error('Parser API URL must use HTTPS (http:// is allowed only for localhost).')
  }

  return trimmed
}

function proxyHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

async function proxyFetchOnce(
  config: ParserProxyConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS)

  try {
    return await fetch(`${config.url}${path}`, {
      ...init,
      headers: { ...proxyHeaders(config.apiKey), ...init?.headers },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function proxyFetch(
  config: ParserProxyConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await proxyFetchOnce(config, path, init)
      if (response.ok || !isRetryableHttpStatus(response.status)) {
        return response
      }
      const body = await response.text()
      throw new Error(`Parser API temporary failure (${response.status}): ${body.slice(0, 120)}`)
    },
    {
      maxAttempts: PARSER_RETRY_MAX_ATTEMPTS,
      baseDelayMs: PARSER_RETRY_BASE_DELAY_MS,
      maxDelayMs: PARSER_RETRY_MAX_DELAY_MS,
      shouldRetry: (error) => isRetryableParserError(error) || isTransientNetworkError(error),
      onRetry: (error, attempt, delayMs) => {
        logger.warn(
          'parserProxy',
          `Request retry ${attempt}/${PARSER_RETRY_MAX_ATTEMPTS} in ${delayMs}ms`,
          error,
        )
      },
    },
  )
}

function mapProxyHttpError(status: number, bodyText: string): Error {
  if (status === 401 || status === 403) {
    return new Error('Parser API rejected the API key. Check Settings and contact your CPS admin.')
  }
  if (status === 413) {
    return new Error('PDF documents are too large for the parser service. Try smaller files.')
  }
  if (status === 429) {
    return new Error('Parser API rate limit reached. Please wait a moment and retry.')
  }
  if (status >= 500) {
    return new Error('Parser service is temporarily unavailable. Please retry in a few minutes.')
  }

  const detail = bodyText.trim().slice(0, 200)
  return new Error(detail ? `Parser API error: ${detail}` : `Parser API request failed (${status}).`)
}

async function readProxyJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!response.ok) {
    try {
      const errBody = JSON.parse(text) as { error?: string }
      if (errBody.error?.trim()) {
        throw new Error(errBody.error.trim())
      }
    } catch (err) {
      if (err instanceof Error && err.message && !/JSON|Unexpected/i.test(err.message)) {
        throw err
      }
    }
    throw mapProxyHttpError(response.status, text)
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Parser API returned an invalid JSON response.')
  }
}

export async function discoverViaProxy(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  peCatalog: Supplier[],
  anchorTerm: string,
): Promise<SupplierDiscoveryResult> {
  const config = await resolveParserProxyConfig()
  if (!config) {
    throw new Error('Parser proxy is not configured.')
  }

  const requestId = randomUUID()
  logger.info('parserProxy', `discover request ${requestId}`)
  const response = await proxyFetch(config, '/v1/discover', {
    method: 'POST',
    headers: { 'X-Request-ID': requestId },
    body: JSON.stringify({
      ratePDF: uint8ArrayToBase64(ratePDF),
      contractForm: uint8ArrayToBase64(contractForm),
      peCatalog,
      anchorTerm,
    }),
  })

  return readProxyJson<SupplierDiscoveryResult>(response)
}

export async function extractViaProxy(
  ratePDF: Uint8Array,
  contractForm: Uint8Array,
  options?: ExtractRatesOptions,
): Promise<ExtractionBatchResult> {
  const config = await resolveParserProxyConfig()
  if (!config) {
    throw new Error('Parser proxy is not configured.')
  }

  const requestId = randomUUID()
  logger.info('parserProxy', `extract request ${requestId}`)
  const response = await proxyFetch(config, '/v1/extract', {
    method: 'POST',
    headers: { 'X-Request-ID': requestId },
    body: JSON.stringify({
      ratePDF: uint8ArrayToBase64(ratePDF),
      contractForm: uint8ArrayToBase64(contractForm),
      options,
    }),
  })

  return readProxyJson<ExtractionBatchResult>(response)
}

export async function testParserProxyConnection(): Promise<{ ok: boolean; message: string }> {
  const config = await resolveParserProxyConfig()
  if (!config) {
    return { ok: false, message: 'Parser API URL and API key are required.' }
  }

  try {
    const response = await proxyFetch(config, '/v1/health', { method: 'GET' })
    const data = await readProxyJson<{ ok: boolean; bedrock?: boolean }>(response)
    if (!data.ok) {
      return { ok: false, message: 'Parser service reported unhealthy status.' }
    }
    return {
      ok: true,
      message: data.bedrock
        ? 'Connected to parser service (Bedrock credentials OK).'
        : 'Connected to parser service.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Parser connection failed.'
    return { ok: false, message }
  }
}
