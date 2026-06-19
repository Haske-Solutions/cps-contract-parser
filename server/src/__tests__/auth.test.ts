import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireApiKey } from '../middleware/auth'

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(payload: unknown) {
      this.body = payload
      return this
    },
  }
  return res as Response & { statusCode: number; body: unknown }
}

describe('requireApiKey', () => {
  const original = process.env.PARSER_API_KEY

  beforeEach(() => {
    process.env.PARSER_API_KEY = 'test-secret-key'
  })

  afterEach(() => {
    process.env.PARSER_API_KEY = original
  })

  it('rejects requests without a bearer token', () => {
    const req = { headers: {} } as Request
    const res = mockRes()
    const next = vi.fn() as NextFunction

    requireApiKey(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects requests with the wrong bearer token', () => {
    const req = { headers: { authorization: 'Bearer wrong-key' } } as Request
    const res = mockRes()
    const next = vi.fn() as NextFunction

    requireApiKey(req, res, next)

    expect(res.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows requests with the correct bearer token', () => {
    const req = { headers: { authorization: 'Bearer test-secret-key' } } as Request
    const res = mockRes()
    const next = vi.fn() as NextFunction

    requireApiKey(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.statusCode).toBe(200)
  })
})
