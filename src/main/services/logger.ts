import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  scope: string
  message: string
  detail?: string
}

const MAX_LOG_BYTES = 2 * 1024 * 1024

let logDir: string | null = null
let logFile: string | null = null

function ensureLogPath(): string {
  if (logFile) return logFile
  logDir = path.join(app.getPath('userData'), 'logs')
  fs.mkdirSync(logDir, { recursive: true })
  logFile = path.join(logDir, 'app.log')
  return logFile
}

function trimLogIfNeeded(filePath: string): void {
  try {
    const stat = fs.statSync(filePath)
    if (stat.size <= MAX_LOG_BYTES) return
    const contents = fs.readFileSync(filePath, 'utf-8')
    const trimmed = contents.slice(-Math.floor(MAX_LOG_BYTES * 0.75))
    fs.writeFileSync(filePath, trimmed, 'utf-8')
  } catch {
    // Best-effort rotation only.
  }
}

function serializeError(err: unknown): string | undefined {
  if (err === undefined || err === null) return undefined
  if (err instanceof Error) {
    return err.stack ?? err.message
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function writeEntry(entry: LogEntry): void {
  const filePath = ensureLogPath()
  const line = `${JSON.stringify(entry)}\n`
  fs.appendFileSync(filePath, line, 'utf-8')
  trimLogIfNeeded(filePath)
}

function log(level: LogLevel, scope: string, message: string, err?: unknown): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    detail: serializeError(err),
  }

  writeEntry(entry)

  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${scope}]`
  if (level === 'error') {
    console.error(prefix, message, err ?? '')
  } else if (level === 'warn') {
    console.warn(prefix, message, err ?? '')
  } else if (process.env.NODE_ENV !== 'production' || level === 'info') {
    console.log(prefix, message)
  }
}

export const logger = {
  debug(scope: string, message: string, err?: unknown): void {
    if (process.env.NODE_ENV !== 'production') {
      log('debug', scope, message, err)
    }
  },
  info(scope: string, message: string, err?: unknown): void {
    log('info', scope, message, err)
  },
  warn(scope: string, message: string, err?: unknown): void {
    log('warn', scope, message, err)
  },
  error(scope: string, message: string, err?: unknown): void {
    log('error', scope, message, err)
  },
  getLogDirectory(): string {
    return path.dirname(ensureLogPath())
  },
}
