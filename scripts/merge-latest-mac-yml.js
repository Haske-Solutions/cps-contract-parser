#!/usr/bin/env node
// Merges the per-architecture latest-mac.yml manifests electron-builder generates
// (one per CI job — arm64, x64) into a single manifest listing every dmg/zip across
// both architectures. electron-updater's macOS auto-updater picks the entry matching
// the running architecture from this combined `files` list.
'use strict'

const fs = require('fs')

function parseLatestMacYml(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const files = []
  let current = null

  const closeCurrent = () => {
    if (current) files.push(current)
    current = null
  }

  for (const line of text.split('\n')) {
    // An unindented line is a top-level key (path:, sha512:, releaseDate:, ...) —
    // it ends whatever file entry we were reading, and must never be mistaken for
    // that entry's own (indented) sha512:/size: fields.
    if (/^\S/.test(line)) {
      closeCurrent()
      continue
    }
    const urlMatch = line.match(/^\s+-\s*url:\s*(.+)\s*$/)
    if (urlMatch) {
      closeCurrent()
      current = { url: urlMatch[1].trim() }
      continue
    }
    if (current) {
      const sha512Match = line.match(/^\s+sha512:\s*(.+)\s*$/)
      const sizeMatch = line.match(/^\s+size:\s*(\d+)\s*$/)
      if (sha512Match) current.sha512 = sha512Match[1].trim()
      if (sizeMatch) current.size = Number(sizeMatch[1])
    }
  }
  closeCurrent()

  const versionMatch = text.match(/^version:\s*(.+)\s*$/m)
  const releaseDateMatch = text.match(/^releaseDate:\s*(.+)\s*$/m)
  return {
    files,
    version: versionMatch ? versionMatch[1].trim() : undefined,
    // Strip the surrounding quotes electron-builder writes — re-added on emit.
    releaseDate: releaseDateMatch ? releaseDateMatch[1].trim().replace(/^'|'$/g, '') : undefined,
  }
}

function main() {
  const [arm64Path, x64Path, outPath] = process.argv.slice(2)
  if (!arm64Path || !x64Path || !outPath) {
    console.error('Usage: merge-latest-mac-yml.js <arm64-yml> <x64-yml> <out-yml>')
    process.exit(1)
  }

  const arm64 = parseLatestMacYml(arm64Path)
  const x64 = parseLatestMacYml(x64Path)
  const files = [...arm64.files, ...x64.files]

  if (files.length === 0) {
    console.error('No file entries found in either manifest — refusing to write an empty latest-mac.yml')
    process.exit(1)
  }

  const version = arm64.version || x64.version
  const releaseDate = arm64.releaseDate || x64.releaseDate
  // Prefer the x64 (no arch suffix) zip as the default entry — it's the most broadly
  // compatible target for updaters that only read the top-level path/sha512 fields.
  const defaultEntry =
    files.find((f) => f.url.endsWith('.zip') && !/arm64/i.test(f.url)) ??
    files.find((f) => f.url.endsWith('.zip')) ??
    files[0]

  const lines = [`version: ${version}`, 'files:']
  for (const f of files) {
    lines.push(`  - url: ${f.url}`, `    sha512: ${f.sha512}`, `    size: ${f.size}`)
  }
  lines.push(`path: ${defaultEntry.url}`, `sha512: ${defaultEntry.sha512}`, `releaseDate: '${releaseDate}'`)

  fs.writeFileSync(outPath, lines.join('\n') + '\n')
  console.log(`Wrote ${outPath} with ${files.length} file entries:`)
  for (const f of files) console.log(`  - ${f.url}`)
}

main()
