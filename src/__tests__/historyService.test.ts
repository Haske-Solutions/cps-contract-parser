import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/cps-test-userdata',
  },
}))

vi.mock('../main/services/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    getLogDirectory: () => '/tmp/cps-test-userdata/logs',
  },
}))

import * as fs from 'fs'
import * as path from 'path'
import { getSession, deleteSession } from '../main/services/historyService'

const sessionsDir = path.join('/tmp/cps-test-userdata', 'sessions')

describe('historyService session ID validation', () => {
  beforeEach(async () => {
    if (fs.existsSync(sessionsDir)) {
      for (const file of fs.readdirSync(sessionsDir)) {
        fs.unlinkSync(path.join(sessionsDir, file))
      }
    }
  })

  it('returns null for path-traversal session IDs', async () => {
    await expect(getSession('../../outside')).resolves.toBeNull()
    await expect(getSession('..%2F..%2Foutside')).resolves.toBeNull()
  })

  it('does not delete files for invalid session IDs', async () => {
    const outsidePath = path.join('/tmp', 'cps-outside-test.json')
    fs.writeFileSync(outsidePath, '{}', 'utf-8')

    await deleteSession('../../outside')

    expect(fs.existsSync(outsidePath)).toBe(true)
    fs.unlinkSync(outsidePath)
  })
})
