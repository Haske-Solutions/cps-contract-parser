import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { ParseSession, HistorySession } from '../../shared/types'
import { logger } from './logger'

const SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

let sessionsDirPath: string | null = null

function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id)
}

async function ensureSessionsDir(): Promise<string> {
  if (sessionsDirPath) return sessionsDirPath
  const dir = path.join(app.getPath('userData'), 'sessions')
  await fs.promises.mkdir(dir, { recursive: true })
  sessionsDirPath = dir
  return dir
}

function sessionFilePath(dir: string, id: string): string {
  if (!isValidSessionId(id)) {
    throw new Error('Invalid session ID')
  }
  return path.join(dir, `${id}.json`)
}

export async function saveSession(session: ParseSession): Promise<void> {
  const dir = await ensureSessionsDir()
  const slim: ParseSession = { ...session, ratePDF: null, contractForm: null }
  await fs.promises.writeFile(sessionFilePath(dir, session.id), JSON.stringify(slim), 'utf-8')
}

export async function listSessions(): Promise<HistorySession[]> {
  const dir = await ensureSessionsDir()
  let files: string[]
  try {
    files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.json'))
  } catch (err) {
    logger.error('history', 'Failed to list session files', err)
    return []
  }

  const sessions = await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await fs.promises.readFile(path.join(dir, file), 'utf-8')
        const session = JSON.parse(raw) as ParseSession
        const status: HistorySession['status'] =
          session.status === 'complete'
            ? 'complete'
            : session.status === 'blocked'
              ? 'blocked'
              : 'in_progress'
        return {
          id: session.id,
          createdAt: session.createdAt,
          supplierName: session.supplier?.name ?? 'Unknown',
          status,
          validationFlagCount: session.validationFlags.length,
          hasExcel: session.outputRows.length > 0,
        } satisfies HistorySession
      } catch {
        return null
      }
    }),
  )

  return sessions
    .filter((session): session is HistorySession => session !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getSession(id: string): Promise<ParseSession | null> {
  if (!isValidSessionId(id)) return null
  const dir = await ensureSessionsDir()
  const filePath = sessionFilePath(dir, id)
  try {
    await fs.promises.access(filePath)
  } catch {
    return null
  }
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as ParseSession
  } catch {
    return null
  }
}

export async function deleteSession(id: string): Promise<void> {
  if (!isValidSessionId(id)) return
  const dir = await ensureSessionsDir()
  const filePath = sessionFilePath(dir, id)
  try {
    await fs.promises.unlink(filePath)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.error('history', `Failed to delete session ${id}`, err)
    }
  }
}

export async function clearAllSessions(): Promise<void> {
  const dir = await ensureSessionsDir()
  const files = (await fs.promises.readdir(dir)).filter((f) => f.endsWith('.json'))
  await Promise.all(files.map((file) => fs.promises.unlink(path.join(dir, file)).catch(() => undefined)))
}
