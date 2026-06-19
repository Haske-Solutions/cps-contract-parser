import { describe, it, expect, vi } from 'vitest'
import {
  isBedrockThrottleError,
  isRetryableHttpStatus,
  isRetryableParserError,
  withRetry,
} from '../shared/retry'

describe('retry helpers', () => {
  it('detects Bedrock throttle messages', () => {
    expect(isBedrockThrottleError(new Error('ThrottlingException: rate exceeded'))).toBe(true)
    expect(isBedrockThrottleError(new Error('AccessDeniedException'))).toBe(false)
  })

  it('detects retryable HTTP statuses', () => {
    expect(isRetryableHttpStatus(429)).toBe(true)
    expect(isRetryableHttpStatus(503)).toBe(true)
    expect(isRetryableHttpStatus(401)).toBe(false)
  })

  it('does not retry auth failures', () => {
    expect(isRetryableParserError(new Error('Could not authenticate with Amazon Bedrock'))).toBe(
      false,
    )
    expect(isRetryableParserError(new Error('ThrottlingException: rate exceeded'))).toBe(true)
  })
})

describe('withRetry', () => {
  it('retries transient failures then succeeds', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce(new Error('ThrottlingException'))
      .mockResolvedValueOnce('ok')

    const result = await withRetry(op, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 2,
    })

    expect(result).toBe('ok')
    expect(op).toHaveBeenCalledTimes(2)
  })

  it('stops retrying after max attempts', async () => {
    const op = vi.fn().mockRejectedValue(new Error('ThrottlingException'))

    await expect(
      withRetry(op, {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 2,
      }),
    ).rejects.toThrow(/ThrottlingException/)

    expect(op).toHaveBeenCalledTimes(3)
  })
})
