import { vi } from 'vitest'

// Native / Electron deps are unavailable in Linux CI (no display, no libsecret, no Electron binary).
// Mock before any main-process module loads.
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/cps-test-user-data'),
    getName: vi.fn(() => 'cps-contract-parser'),
    getVersion: vi.fn(() => '1.0.0'),
    getAppPath: vi.fn(() => '/tmp/cps-test-app'),
  },
}))

vi.mock('keytar', () => ({
  getPassword: vi.fn(async () => null),
  setPassword: vi.fn(async () => undefined),
  deletePassword: vi.fn(async () => true),
  findCredentials: vi.fn(async () => []),
}))
