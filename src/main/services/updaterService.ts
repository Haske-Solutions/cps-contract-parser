import { app, BrowserWindow, dialog } from 'electron'
import type { UpdateCheckResult, UpdateStatus } from '../../shared/types'
import { logger } from './logger'

export const UPDATE_STATUS_CHANNEL = 'app:updateStatus'

let initialized = false
let eventsAttached = false
let mainWindow: BrowserWindow | null = null
let autoUpdater: import('electron-updater').AppUpdater | null = null
let pendingUpdateVersion = ''

function isUpdaterEnabled(): boolean {
  return process.env.NODE_ENV !== 'development' && app.isPackaged
}

function getAutoUpdater(): import('electron-updater').AppUpdater {
  if (!autoUpdater) {
    // Lazy require keeps dev startup fast and avoids bundler edge cases.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater: updater } = require('electron-updater') as typeof import('electron-updater')
    autoUpdater = updater
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    autoUpdater.logger = {
      info: (message: string) => logger.info('updater', message),
      warn: (message: string) => logger.warn('updater', message),
      error: (message: string) => logger.error('updater', message),
      debug: (message: string) => logger.debug('updater', message),
    }
  }
  return autoUpdater
}

function emitStatus(status: UpdateStatus): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(UPDATE_STATUS_CHANNEL, status)
    }
  }
}

function attachAutoUpdaterEvents(): void {
  if (eventsAttached) return
  eventsAttached = true

  const updater = getAutoUpdater()

  updater.on('checking-for-update', () => {
    logger.info('updater', 'Checking for updates')
    emitStatus({ status: 'checking' })
  })

  updater.on('update-available', (info) => {
    pendingUpdateVersion = info.version
    logger.info('updater', `Update available: ${info.version}`)
    emitStatus({ status: 'available', version: info.version })

    const focused = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!focused || focused.isDestroyed()) return

    void dialog
      .showMessageBox(focused, {
        type: 'info',
        title: 'Update available',
        message: `CPS Contract Parser ${info.version} is available.`,
        detail: 'The update is downloading in the background. You will be prompted to restart when it is ready.',
        buttons: ['OK'],
      })
      .catch((err: Error) => {
        logger.error('updater', 'Failed to show update-available dialog', err)
      })
  })

  updater.on('update-not-available', (info) => {
    logger.info('updater', 'Application is up to date')
    emitStatus({ status: 'not-available', version: info.version })
  })

  updater.on('download-progress', (progress) => {
    emitStatus({
      status: 'downloading',
      version: pendingUpdateVersion,
      percent: progress.percent,
    })
  })

  updater.on('error', (err: Error) => {
    logger.error('updater', 'Auto-update failed', err)
    emitStatus({ status: 'error', message: err.message })
  })

  updater.on('update-downloaded', (info) => {
    logger.info('updater', `Update downloaded: ${info.version}`)
    emitStatus({ status: 'downloaded', version: info.version })

    const focused = BrowserWindow.getFocusedWindow() ?? mainWindow
    if (!focused || focused.isDestroyed()) return

    void dialog
      .showMessageBox(focused, {
        type: 'info',
        title: 'Update ready',
        message: `CPS Contract Parser ${info.version} has been downloaded.`,
        detail: 'Restart the app to install the update.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          updater.quitAndInstall()
        }
      })
      .catch((err: Error) => {
        logger.error('updater', 'Failed to show update-downloaded dialog', err)
      })
  })
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!isUpdaterEnabled()) {
    const message = 'Auto-update is only available in installed release builds.'
    emitStatus({ status: 'disabled', reason: message })
    return { ok: false, message }
  }

  attachAutoUpdaterEvents()
  emitStatus({ status: 'checking' })

  try {
    await getAutoUpdater().checkForUpdates()
    return { ok: true, message: 'Update check complete.' }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update check failed'
    emitStatus({ status: 'error', message })
    return { ok: false, message }
  }
}

export function quitAndInstallUpdate(): void {
  if (!isUpdaterEnabled()) return
  attachAutoUpdaterEvents()
  getAutoUpdater().quitAndInstall()
}

export function initAutoUpdater(window: BrowserWindow): void {
  mainWindow = window

  if (initialized) return
  initialized = true

  if (!isUpdaterEnabled()) {
    logger.info('updater', 'Skipping auto-update in development')
    emitStatus({ status: 'disabled', reason: 'Auto-update is disabled in development builds.' })
    return
  }

  attachAutoUpdaterEvents()

  setTimeout(() => {
    void checkForUpdates().catch((err: Error) => {
      logger.error('updater', 'Initial update check failed', err)
    })
  }, 10_000)
}
