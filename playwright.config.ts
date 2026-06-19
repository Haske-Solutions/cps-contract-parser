import { defineConfig } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  // Note: E2E tests require a prior `npm run build` — dist/main/main.js must exist.
  // Run with: npm run build && npm run test:e2e
  projects: [
    {
      name: 'electron',
      testMatch: '**/*.spec.ts',
      use: {
        // Electron apps are launched directly; Playwright drives their Chromium renderer.
        // The main entry point is passed via _electron.launch() inside each test file.
        launchOptions: {
          executablePath: path.join(__dirname, 'node_modules', '.bin', 'electron'),
        },
      },
    },
  ],
})
