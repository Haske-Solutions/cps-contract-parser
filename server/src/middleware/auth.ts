import type { Request, Response, NextFunction } from 'express'

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.PARSER_API_KEY?.trim()
  if (!expected) {
    res.status(500).json({ error: 'PARSER_API_KEY is not configured on the server.' })
    return
  }

  const header = req.headers.authorization ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  const provided = match?.[1]?.trim()

  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Invalid or missing API key.' })
    return
  }

  next()
}
