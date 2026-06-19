import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp/cps-test-userdata',
  },
}))

import * as fs from 'fs'
import * as path from 'path'
import { getSession, deleteSession } from '../main/services/historyService'

const sessionsDir = path.join('/tmp/cps-test-userdata', 'sessions')

describe('historyService session ID validation', () => {
  beforeEach(() => {
    if (fs.existsSync(sessionsDir)) {
      for (const file of fs.readdirSync(sessionsDir)) {
        fs.unlinkSync(path.join(sessionsDir, file))
      }
    }
  })

  it('returns null for path-traversal session IDs', () => {
    expect(getSession('../../outside')).toBeNull()
    expect(getSession('..%2F..%2Foutside')).toBeNull()
  })

  it('does not delete files for invalid session IDs', () => {
    const outsidePath = path.join('/tmp', 'cps-outside-test.json')
    fs.writeFileSync(outsidePath, '{}', 'utf-8')

    deleteSession('../../outside')

    expect(fs.existsSync(outsidePath)).toBe(true)
    fs.unlinkSync(outsidePath)
  })
})
