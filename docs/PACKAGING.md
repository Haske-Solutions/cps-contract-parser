# Packaging CPS Contract Parser

Desktop installers are built with [electron-builder](https://www.electron.build/). Output goes to `release/`.

## Platform rules (important)

This app uses **native Node modules** (`@duckdb/node-api`, `keytar`). Each platform needs its own prebuilt `.node` binary.

| Build host | macOS installer | Windows installer |
|------------|-----------------|-------------------|
| macOS | Yes | **No** — missing `duckdb.node` / `keytar` for Windows |
| Windows | **No** | Yes |
| GitHub Actions (`macos-latest` + `windows-latest`) | Yes | Yes |

**Do not run** `electron-builder --mac --win` on a Mac and expect the Windows `.exe` to work. You will see:

```text
Cannot find module '@duckdb/node-bindings-win32-x64/duckdb.node'
```

`asarUnpack` in `electron-builder.yml` only unpacks binaries that were bundled; cross-compiling from macOS never installs the Windows bindings.

## Local builds

### macOS (on a Mac)

```bash
npm ci
npm run branding:generate   # first time or after icon changes
npm run package:mac -- -p never
```

Artifacts: `release/*-arm64.dmg` (Apple Silicon) and `release/*.dmg` without `-arm64` in the name (Intel x64). Unpacked apps under `release/mac-arm64/` and `release/mac/`.

**Important:** Install the DMG that matches your Mac CPU. The wrong installer fails at launch:

```text
keytar.node: incompatible architecture (have 'arm64', need 'x86_64')
```

| Your Mac | Download |
|----------|----------|
| Apple Silicon (M1/M2/M3/M4) | `*-arm64.dmg` |
| Intel | `*.dmg` **without** `-arm64` in the filename |

After installing, you can confirm the bundled native module matches your CPU:

```bash
file "/Applications/CPS Contract Parser.app/Contents/Resources/app.asar.unpacked/node_modules/keytar/build/Release/keytar.node"
# Intel Mac should show: x86_64
# Apple Silicon should show: arm64
```

CI builds each macOS architecture in a **separate job** with a fresh `npm ci` and an explicit `keytar` rebuild (`scripts/package-mac-ci.sh`), then verifies with `scripts/verify-mac-native.sh`.

Signing/notarization runs only when `CSC_*` and `APPLE_*` GitHub secrets are set. Without them, CI builds **unsigned** DMGs (see `scripts/package-mac-ci.sh`). Users may need right-click → Open on first launch.

### Windows (on a Windows PC)

```bash
npm ci
npm run package:win -- -p never
```

Artifact: `release/*.exe` (NSIS installer). Windows code signing is currently disabled (`sign: null` in `electron-builder.yml`).

## CI builds (recommended for Windows)

### Manual package (no git tag)

1. Open **Actions** → **Package** → **Run workflow**
2. Choose `mac`, `win`, or `both`
3. Download artifacts from the completed run

### Release (git tag)

Push a semver tag to trigger a full release with GitHub Release upload:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Requires `v*.*.*` tag pattern (see `.github/workflows/release.yml`).

## Automatic updates

Installed release builds check [GitHub Releases](https://github.com/Haske-Solutions/cps-contract-parser/releases) for updates about **10 seconds after launch** and when you click **Check for updates** in Settings.

| Event | What users see |
|-------|----------------|
| Update available | Dialog + toast; download starts in the background |
| Download complete | Dialog with **Restart now** / **Later**; also in Settings |
| Up to date | Status message in Settings after a manual check |

Release CI uploads `latest*.yml` metadata alongside installers so `electron-updater` can verify and download updates. The sidebar shows the running app version (from `package.json`).

Auto-update requires a **packaged install** (not `npm run dev`). macOS unsigned builds may block updates until signing is configured.

## Verify native modules after packaging

**Windows** (PowerShell, from repo root after `package:win`):

```powershell
Get-ChildItem -Path "release\win-unpacked" -Recurse -Filter "duckdb.node"
```

Or use `pwsh -File scripts/verify-duckdb-packaged.ps1` after packaging.

**macOS** (Apple Silicon example):

```bash
test -f "release/mac-arm64/CPS Contract Parser.app/Contents/Resources/app.asar.unpacked/node_modules/@duckdb/node-bindings-darwin-arm64/duckdb.node"
```

If these paths are missing, the installer was built on the wrong OS.

## Cleaning

Safe to delete build output:

```bash
rm -rf dist release
```

`npm run build` recreates `dist/`; `electron-builder` recreates `release/`.
