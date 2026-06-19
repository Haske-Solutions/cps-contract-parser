import { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api'
import { DEFAULT_MOTHERDUCK_DATABASE } from '../../shared/constants'
import { resolveMotherduckToken } from './keystoreService'

const QUERY_TIMEOUT_MS = 90_000

let instance: DuckDBInstance | null = null
let connection: DuckDBConnection | null = null
let cachedToken: string | null = null

function motherduckPath(): string {
  return `md:${DEFAULT_MOTHERDUCK_DATABASE}`
}

function queryTimeoutError(): Error {
  return new Error(
    `MotherDuck query timed out after ${QUERY_TIMEOUT_MS / 1000}s. Open Settings and use Test Connection to verify your MotherDuck token.`,
  )
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(queryTimeoutError()), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function getConnection(): Promise<DuckDBConnection> {
  const token = await resolveMotherduckToken()
  if (!token) {
    throw new Error(
      'MotherDuck token not configured. Set MOTHERDUCK_TOKEN in .env or save a token in Settings.',
    )
  }

  if (connection && cachedToken === token) {
    return connection
  }

  closeMotherduck()

  const inst = await DuckDBInstance.fromCache(motherduckPath(), { motherduck_token: token })
  const conn = await inst.connect()

  instance = inst
  connection = conn
  cachedToken = token
  return conn
}

export function resetMotherduckConnection(): void {
  closeMotherduck()
}

export function closeMotherduck(): void {
  if (connection) {
    connection.closeSync()
    connection = null
  }
  if (instance) {
    instance.closeSync()
    instance = null
  }
  cachedToken = null
}

export async function runQuery<T>(sql: string): Promise<T[]> {
  const conn = await getConnection()
  const reader = await withTimeout(conn.runAndReadAll(sql), QUERY_TIMEOUT_MS)
  return reader.getRowObjectsJS() as T[]
}

export async function runQueryBound<T>(
  sql: string,
  params: string[],
): Promise<T[]> {
  const conn = await getConnection()
  const stmt = await withTimeout(conn.prepare(sql), QUERY_TIMEOUT_MS)
  for (let i = 0; i < params.length; i++) {
    stmt.bindVarchar(i + 1, params[i])
  }
  const reader = await withTimeout(stmt.runAndReadAll(), QUERY_TIMEOUT_MS)
  return reader.getRowObjectsJS() as T[]
}

export async function testMotherduckConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const rows = await runQuery<{ ok: number }>('SELECT 1 AS ok')
    if (rows.length > 0 && rows[0].ok === 1) {
      return { ok: true, message: 'MotherDuck connection successful' }
    }
    return { ok: false, message: 'Connected but test query returned no rows' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}
