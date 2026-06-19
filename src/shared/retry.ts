export interface RetryOptions {
  maxAttempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  /** Return true to retry this error. */
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
}

const DEFAULT_MAX_ATTEMPTS = 4
const DEFAULT_BASE_DELAY_MS = 1000
const DEFAULT_MAX_DELAY_MS = 30_000

export function isTransientNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|fetch failed|network|socket hang up|aborted/i.test(
    msg,
  )
}

export function isBedrockThrottleError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /throttl|rate exceeded|too many requests|service unavailable|503|502|504|timeout/i.test(msg)
}

export function isRetryableParserError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (/authenticate|access\s*denied|unauthorized|invalid.*model|api key|not configured|P1:/i.test(error.message)) {
    return false
  }
  return isBedrockThrottleError(error) || isTransientNetworkError(error)
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function backoffMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * 2 ** (attempt - 1)
  const jitter = Math.floor(Math.random() * baseDelayMs * 0.25)
  return Math.min(exponential + jitter, maxDelayMs)
}

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS
  const shouldRetry = options.shouldRetry ?? isRetryableParserError

  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt)
    } catch (error) {
      lastError = error
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error
      }
      const waitMs = backoffMs(attempt, baseDelayMs, maxDelayMs)
      options.onRetry?.(error, attempt, waitMs)
      await delay(waitMs)
    }
  }

  throw lastError
}
