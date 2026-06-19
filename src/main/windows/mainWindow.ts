import { BrowserWindow } from 'electron'
import * as path from 'path'

const isDev = process.env.NODE_ENV === 'development'

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CPS Contract Parser',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // tsconfig rootDir=src, outDir=dist/main → __dirname is dist/main/main/windows
      preload: path.join(__dirname, '../../preload/preload.js'),
    },
  })

  if (isDev) {
    void win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    void win.loadFile(path.join(__dirname, '../../../renderer/index.html'))
  }

  return win
}
