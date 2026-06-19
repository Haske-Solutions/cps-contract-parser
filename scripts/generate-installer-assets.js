#!/usr/bin/env node
/**
 * Generate DMG background + NSIS installer BMPs from resources/icon.png.
 * Run: npm run installer-assets:generate
 * Requires sharp (installed on demand via npx -p sharp).
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { Jimp } = require('jimp')

const ROOT = path.join(__dirname, '..')
const RES = path.join(ROOT, 'resources')
const ICON = path.join(RES, 'icon.png')

if (!fs.existsSync(ICON)) {
  console.error('Missing resources/icon.png')
  process.exit(1)
}
const COLORS = {
  bg: '#FAFAF9',
  card: '#FFFFFF',
  text: '#2A2A28',
  muted: '#6B6B66',
  primary: '#8B2635',
  gold: '#C4A35A',
  border: '#E5E4E2',
}

function dmgBackgroundSvg(width, height) {
  const cx1 = Math.round(width * 0.28)
  const cx2 = Math.round(width * 0.72)
  const cy = Math.round(height * 0.48)
  const arrowY = cy
  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${COLORS.gold}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${COLORS.gold}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="${COLORS.bg}"/>
  <rect x="0" y="0" width="8" height="100%" fill="${COLORS.primary}"/>
  <rect x="32" y="36" width="${width - 64}" height="${height - 72}" rx="16" fill="${COLORS.card}" stroke="${COLORS.border}" stroke-width="1"/>
  <rect x="32" y="36" width="${width - 64}" height="72" rx="16" fill="url(#gold)"/>
  <text x="56" y="78" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.round(width * 0.028)}" font-weight="600" fill="${COLORS.muted}" letter-spacing="3">CPS</text>
  <text x="56" y="${Math.round(height * 0.19)}" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.round(width * 0.052)}" font-weight="700" fill="${COLORS.text}">Contract Parser</text>
  <text x="${Math.round(width / 2)}" y="${height - 48}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${Math.round(width * 0.032)}" fill="${COLORS.muted}">Drag to Applications to install</text>
  <circle cx="${cx1}" cy="${cy}" r="${Math.round(width * 0.09)}" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="${cx2}" cy="${cy}" r="${Math.round(width * 0.09)}" fill="${COLORS.bg}" stroke="${COLORS.border}" stroke-width="2" stroke-dasharray="6 4"/>
  <path d="M ${cx1 + Math.round(width * 0.11)} ${arrowY} L ${cx2 - Math.round(width * 0.11)} ${arrowY} M ${cx2 - Math.round(width * 0.14)} ${arrowY - 10} L ${cx2 - Math.round(width * 0.11)} ${arrowY} L ${cx2 - Math.round(width * 0.14)} ${arrowY + 10}"
        fill="none" stroke="${COLORS.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

function sidebarSvg() {
  return `<svg width="164" height="314" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="side" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLORS.primary}"/>
      <stop offset="100%" stop-color="#5A1520"/>
    </linearGradient>
  </defs>
  <rect width="164" height="314" fill="url(#side)"/>
  <rect x="0" y="0" width="6" height="314" fill="${COLORS.gold}"/>
  <text x="20" y="248" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#FFFFFF" opacity="0.85" letter-spacing="2">CPS</text>
  <text x="20" y="268" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">Contract</text>
  <text x="20" y="284" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#FFFFFF">Parser</text>
  <text x="20" y="304" font-family="system-ui, sans-serif" font-size="9" fill="#FFFFFF" opacity="0.65">Cheli &amp; Peacock</text>
</svg>`
}

function headerSvg() {
  return `<svg width="150" height="57" xmlns="http://www.w3.org/2000/svg">
  <rect width="150" height="57" fill="${COLORS.primary}"/>
  <rect x="0" y="0" width="150" height="3" fill="${COLORS.gold}"/>
  <text x="12" y="24" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#FFFFFF" opacity="0.85" letter-spacing="1.5">CPS</text>
  <text x="12" y="42" font-family="system-ui, sans-serif" font-size="14" font-weight="700" fill="#FFFFFF">Contract Parser</text>
</svg>`
}

async function compositeIcon(baseSvg, iconSize, iconX, iconY) {
  const iconBuf = await sharp(ICON)
    .resize(iconSize, iconSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp(Buffer.from(baseSvg, 'utf8')).composite([{ input: iconBuf, left: iconX, top: iconY }])
}

async function writePng(imagePromise, out) {
  const image = await imagePromise
  await image.png().toFile(out)
}

async function writeBmp(imagePromise, out, flattenColor) {
  const image = await imagePromise
  const pngBuf = await image.flatten({ background: flattenColor }).toColourspace('srgb').png().toBuffer()
  const jimpImage = await Jimp.read(pngBuf)
  await jimpImage.write(out)
}

async function main() {
  console.log('Generating DMG backgrounds…')
  for (const [name, w, h] of [
    ['dmg-background.png', 658, 498],
    ['dmg-background@2x.png', 1316, 996],
  ]) {
    const svg = dmgBackgroundSvg(w, h)
    const cx1 = Math.round(w * 0.28)
    const cy = Math.round(h * 0.48)
    const iconSize = Math.round(w * 0.14)
    const out = path.join(RES, name)
    await writePng(
      compositeIcon(svg, iconSize, cx1 - Math.round(iconSize / 2), cy - Math.round(iconSize / 2)),
      out,
    )
    console.log(`  → ${out}`)
  }

  console.log('Generating NSIS installer art…')
  const sidebarIconSize = 96
  const sidebarOut = path.join(RES, 'installer-sidebar.bmp')
  await writeBmp(compositeIcon(sidebarSvg(), sidebarIconSize, 34, 120), sidebarOut, COLORS.primary)
  console.log(`  → ${sidebarOut}`)

  const headerIconSize = 40
  const headerOut = path.join(RES, 'installer-header.bmp')
  await writeBmp(compositeIcon(headerSvg(), headerIconSize, 100, 8), headerOut, COLORS.primary)
  console.log(`  → ${headerOut}`)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
