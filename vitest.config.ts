import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

const mocksDir = resolve(__dirname, 'src/__tests__/mocks')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer'),
      // Stub native deps unavailable on Linux CI (no Electron binary, no libsecret).
      electron: resolve(mocksDir, 'electron.ts'),
      keytar: resolve(mocksDir, 'keytar.ts'),
    },
  },
})
