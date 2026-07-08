#!/usr/bin/env node
/**
 * Ensure the electron npm package has a working binary + path.txt.
 *
 * electron's install.js fires download/extract asynchronously and can exit before
 * path.txt is written (seen on Node 24). This script re-runs the install when
 * the marker files are missing.
 */
const { downloadArtifact } = require('@electron/get')
const extract = require('extract-zip')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const electronDir = path.join(__dirname, '..', 'node_modules', 'electron')
const { version } = require(path.join(electronDir, 'package.json'))

const platformPath =
  process.platform === 'darwin'
    ? 'Electron.app/Contents/MacOS/Electron'
    : process.platform === 'win32'
      ? 'electron.exe'
      : 'electron'

function binaryPath() {
  return path.join(electronDir, 'dist', platformPath)
}

function isInstalled() {
  try {
    const distVersion = fs
      .readFileSync(path.join(electronDir, 'dist', 'version'), 'utf-8')
      .replace(/^v/, '')
    const recordedPath = fs.readFileSync(path.join(electronDir, 'path.txt'), 'utf-8')
    return distVersion === version && recordedPath === platformPath && fs.existsSync(binaryPath())
  } catch {
    return false
  }
}

async function extractZip(zipPath, destDir) {
  if (process.platform === 'darwin') {
    // extract-zip can silently produce an incomplete Electron.app on recent Node versions.
    execFileSync('unzip', ['-q', zipPath, '-d', destDir], { stdio: 'inherit' })
    return
  }

  await extract(zipPath, { dir: destDir })
}

async function installElectron() {
  const arch =
    process.platform === 'darwin' && process.arch === 'x64'
      ? (() => {
          try {
            return require('child_process')
              .execSync('sysctl -in sysctl.proc_translated')
              .toString()
              .trim() === '1'
              ? 'arm64'
              : 'x64'
          } catch {
            return 'x64'
          }
        })()
      : process.arch

  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: process.platform,
    arch,
    checksums: require(path.join(electronDir, 'checksums.json')),
  })

  const distDir = path.join(electronDir, 'dist')
  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })

  await extractZip(zipPath, distDir)

  const srcTypeDef = path.join(distDir, 'electron.d.ts')
  const targetTypeDef = path.join(electronDir, 'electron.d.ts')
  if (fs.existsSync(srcTypeDef)) {
    fs.renameSync(srcTypeDef, targetTypeDef)
  }

  await fs.promises.writeFile(path.join(electronDir, 'path.txt'), platformPath)
}

async function main() {
  if (process.env.ELECTRON_SKIP_BINARY_DOWNLOAD) return
  if (isInstalled()) return

  console.log(`→ Installing Electron ${version} binary (${process.platform}/${process.arch})`)
  await installElectron()

  if (!isInstalled()) {
    console.error('Electron binary install failed — path.txt or binary still missing.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
