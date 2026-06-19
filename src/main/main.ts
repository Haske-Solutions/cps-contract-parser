import { app, BrowserWindow, crashReporter } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { createMainWindow } from './windows/mainWindow'
import { registerHandlers } from './ipc/handlers'
import { closeMotherduck } from './services/motherduckClient'
import { initKeystoreConfig } from './services/keystoreService'
import { logger } from './services/logger'
import { initAutoUpdater } from './services/updaterService'

// Load .env in development so local config is available without shell exports.
// Only sets variables that are not already in the environment.
function loadDotEnv(): void {
  const envFile = path.join(__dirname, '../../.env')
  if (!fs.existsSync(envFile)) return
  const lines = fs.readFileSync(envFile, 'utf-8').split('\n')
  for (const line of lines) {
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

function initCrashReporter(): void {
  crashReporter.start({
    productName: 'CPS Contract Parser',
    companyName: 'Cheli and Peacock Safaris',
    submitURL: process.env.CRASH_REPORT_URL?.trim() || '',
    uploadToServer: Boolean(process.env.CRASH_REPORT_URL?.trim()),
    compress: true,
    ignoreSystemCrashHandler: false,
  })
}

function registerProcessDiagnostics(): void {
  process.on('uncaughtException', (err) => {
    logger.error('process', 'Uncaught exception', err)
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('process', 'Unhandled promise rejection', reason)
  })
}

if (process.env.NODE_ENV !== 'production') {
  loadDotEnv()
}

registerProcessDiagnostics()
initCrashReporter()

app.whenReady().then(async () => {
  await initKeystoreConfig()
  logger.info('app', `Starting CPS Contract Parser v${app.getVersion()}`)
  logger.info('crashReporter', `Crash dumps directory: ${app.getPath('crashDumps')}`)
  logger.info('logger', `Log file directory: ${logger.getLogDirectory()}`)
  const mainWindow = createMainWindow()
  registerHandlers()
  initAutoUpdater(mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const win = createMainWindow()
      initAutoUpdater(win)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  closeMotherduck()
  logger.info('app', 'Application shutting down')
})
