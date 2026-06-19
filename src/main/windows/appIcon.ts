import { app, nativeImage } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

/** Window / dock icon — dev (project resources) and packaged (extraResources). */
export function resolveWindowIcon(): Electron.NativeImage | undefined {
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'icon.png'),
        path.join(process.resourcesPath, 'icon.icns'),
      ]
    : [
        path.join(process.cwd(), 'resources', 'icon.png'),
        path.join(app.getAppPath(), 'resources', 'icon.png'),
      ]

  for (const iconPath of candidates) {
    if (!fs.existsSync(iconPath)) continue
    const image = nativeImage.createFromPath(iconPath)
    if (!image.isEmpty()) return image
  }

  return undefined
}
