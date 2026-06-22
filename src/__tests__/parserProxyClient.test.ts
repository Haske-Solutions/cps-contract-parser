import { describe, it, expect, vi } from 'vitest'

vi.mock('../main/services/keystoreService', () => ({
  getParserProxyUrl: vi.fn(),
  resolveParserApiKey: vi.fn(),
}))

vi.mock('../main/services/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { normalizeProxyUrl } from '../main/services/parserProxyClient'

describe('normalizeProxyUrl', () => {
  it('strips trailing slashes', () => {
    expect(normalizeProxyUrl('https://parser.example.com/')).toBe('https://parser.example.com')
  })

  it('allows http for localhost', () => {
    expect(normalizeProxyUrl('http://localhost:8080')).toBe('http://localhost:8080')
  })

  it('rejects non-https remote URLs', () => {
    expect(() => normalizeProxyUrl('http://parser.example.com')).toThrow(/HTTPS/i)
  })

  it('rejects invalid URLs', () => {
    expect(() => normalizeProxyUrl('not-a-url')).toThrow(/valid URL/i)
  })
})

describe('resolveParserProxyConfig', () => {
  it('returns null when no proxy URL is configured', async () => {
    vi.doMock('../main/services/keystoreService', () => ({
      getParserProxyUrl: () => '',
      resolveParserApiKey: vi.fn(),
    }))
    const { resolveParserProxyConfig } = await import('../main/services/parserProxyClient')
    await expect(resolveParserProxyConfig()).resolves.toBeNull()
    vi.resetModules()
  })
})
