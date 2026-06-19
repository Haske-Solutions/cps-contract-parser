import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { ParseSession, HistorySession } from '../../shared/types'

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id)
}

function sessionsDir(): string {
  const dir = path.join(app.getPath('userData'), 'sessions')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function sessionFilePath(id: string): string {
  if (!isValidSessionId(id)) {
    throw new Error('Invalid session ID')
  }
  return path.join(sessionsDir(), `${id}.json`)
}

export function saveSession(session: ParseSession): void {
  const slim: ParseSession = { ...session, ratePDF: null, contractForm: null }
  fs.writeFileSync(sessionFilePath(session.id), JSON.stringify(slim), 'utf-8')
}

export function listSessions(): HistorySession[] {
  const dir = sessionsDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  const result: HistorySession[] = []
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), 'utf-8')
      const session = JSON.parse(raw) as ParseSession
      const status: HistorySession['status'] =
        session.status === 'complete' ? 'complete'
        : session.status === 'blocked' ? 'blocked'
        : 'in_progress'
      result.push({
        id: session.id,
        createdAt: session.createdAt,
        supplierName: session.supplier?.name ?? 'Unknown',
        status,
        validationFlagCount: session.validationFlags.length,
        hasExcel: session.outputRows.length > 0,
      })
    } catch {
      // skip corrupted session files
    }
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSession(id: string): ParseSession | null {
  if (!isValidSessionId(id)) return null
  const filePath = sessionFilePath(id)
  if (!fs.existsSync(filePath)) return null
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ParseSession
  } catch {
    return null
  }
}

export function deleteSession(id: string): void {
  if (!isValidSessionId(id)) return
  const filePath = sessionFilePath(id)
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

export function clearAllSessions(): void {
  const dir = sessionsDir()
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    fs.unlinkSync(path.join(dir, file))
  }
}
