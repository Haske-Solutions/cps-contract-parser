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

/**
 * Map GitHub/electron-updater failures to user-facing guidance.
 * 'unavailable' is for failures that are often transient (network blip, feed not yet
 * propagated, private repo) — the UI keeps the retry button live for these. 'error' is
 * for everything else. Neither implies the permanent 'disabled' status (dev/unpackaged
 * builds only), which the UI treats as non-retryable.
 */
function classifyUpdateError(err: unknown): { kind: 'unavailable' | 'error'; message: string } {
  const raw = err instanceof Error ? err.message : String(err)
  const is404 =
    raw.includes('404') ||
    raw.includes('releases.atom') ||
    /status code\s*404/i.test(raw)

  if (is404) {
    return {
      kind: 'unavailable',
      message:
        'Automatic updates are unavailable. The GitHub release feed could not be reached — ' +
        'this usually means the repository is private, no GitHub Release has been published yet, ' +
        'or the installed build points at the wrong repo. Install updates manually from your IT team or GitHub Releases.',
    }
  }

  if (/authentication token|401|403/i.test(raw)) {
    return {
      kind: 'unavailable',
      message:
        'Automatic updates require access to the private GitHub release feed. ' +
        'Install new versions manually until a public update channel is configured.',
    }
  }

  return { kind: 'error', message: raw || 'Update check failed' }
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
    const classified = classifyUpdateError(err)
    if (classified.kind === 'unavailable') {
      logger.warn('updater', classified.message)
      emitStatus({ status: 'unavailable', reason: classified.message })
      return
    }
    logger.error('updater', 'Auto-update failed', err)
    emitStatus({ status: 'error', message: classified.message })
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
    const classified = classifyUpdateError(err)
    if (classified.kind === 'unavailable') {
      emitStatus({ status: 'unavailable', reason: classified.message })
      return { ok: false, message: classified.message }
    }
    emitStatus({ status: 'error', message: classified.message })
    return { ok: false, message: classified.message }
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
