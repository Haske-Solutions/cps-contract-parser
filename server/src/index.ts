import express from 'express'
import rateLimit from 'express-rate-limit'
import * as fs from 'fs'
import * as path from 'path'
import { requireApiKey } from './middleware/auth'
import { parserRouter } from './routes/parser'

/** Load server/.env for local development (does not override existing env vars). */
function loadDotEnv(): void {
  const envFile = path.join(__dirname, '..', '.env')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const raw = trimmed.slice(eqIdx + 1).trim()
    const value = raw.replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadDotEnv()

const PORT = Number(process.env.PORT ?? 8080)

if (!process.env.PARSER_API_KEY?.trim()) {
  console.error('FATAL: PARSER_API_KEY environment variable is required.')
  process.exit(1)
}

const app = express()

app.use(express.json({ limit: '50mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please retry in a minute.' },
})

app.use('/v1', limiter, requireApiKey, parserRouter)

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (err && typeof err === 'object' && 'type' in err && (err as { type?: string }).type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body too large.' })
      return
    }
    next(err)
  },
)

app.listen(PORT, () => {
  console.log(`CPS Parser API listening on port ${PORT}`)
})
