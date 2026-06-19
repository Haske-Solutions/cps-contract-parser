import { app, BrowserWindow, dialog } from 'electron'
import { logger } from './logger'

let initialized = false

export function initAutoUpdater(mainWindow: BrowserWindow): void {
  if (initialized) return
  initialized = true

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    logger.info('updater', 'Skipping auto-update in development')
    return
  }

  // Lazy require keeps dev startup fast and avoids bundler edge cases.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info: (message: string) => logger.info('updater', message),
    warn: (message: string) => logger.warn('updater', message),
    error: (message: string) => logger.error('updater', message),
    debug: (message: string) => logger.debug('updater', message),
  }

  autoUpdater.on('checking-for-update', () => {
    logger.info('updater', 'Checking for updates')
  })

  autoUpdater.on('update-available', (info) => {
    logger.info('updater', `Update available: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    logger.info('updater', 'Application is up to date')
  })

  autoUpdater.on('error', (err: Error) => {
    logger.error('updater', 'Auto-update failed', err)
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('updater', `Update downloaded: ${info.version}`)
    const focused = BrowserWindow.getFocusedWindow() ?? mainWindow
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
          autoUpdater.quitAndInstall()
        }
      })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((err: Error) => {
      logger.error('updater', 'Initial update check failed', err)
    })
  }, 10_000)
}
