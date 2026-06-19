import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { createMainWindow } from './windows/mainWindow'
import { registerHandlers } from './ipc/handlers'
import { closeMotherduck } from './services/motherduckClient'

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

if (process.env.NODE_ENV !== 'production') {
  loadDotEnv()
}

app.whenReady().then(() => {
  createMainWindow()
  registerHandlers()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  closeMotherduck()
})
