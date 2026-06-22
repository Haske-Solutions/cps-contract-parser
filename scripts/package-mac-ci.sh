#!/usr/bin/env bash
# macOS packaging for CI and local release builds.
# Builds one or both DMGs with native modules (keytar, duckdb) matching the target CPU.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ELECTRON_BUILDER="${ROOT}/node_modules/.bin/electron-builder"
DUCKDB_BINDINGS_VERSION="1.5.3-r.3"

if [[ ! -x "$ELECTRON_BUILDER" ]]; then
  echo "electron-builder not found at ${ELECTRON_BUILDER}. Run npm ci first." >&2
  exit 1
fi

echo "→ Using $("$ELECTRON_BUILDER" --version)"

if [[ -n "${CSC_LINK_RAW:-}" ]]; then
  echo "→ Apple signing identity configured; building signed macOS apps"
  export CSC_LINK="$CSC_LINK_RAW"
  export CSC_KEY_PASSWORD="${CSC_KEY_PASSWORD_RAW:-}"
  export APPLE_ID="${APPLE_ID_RAW:-}"
  export APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD_RAW:-}"
  export APPLE_TEAM_ID="${APPLE_TEAM_ID_RAW:-}"
else
  echo "→ No CSC_LINK secret; building unsigned macOS apps"
  echo "  (Users may need right-click → Open on first launch.)"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
fi

config_for_arch() {
  local arch="$1"
  if [[ -n "${CSC_LINK_RAW:-}" ]]; then
    echo "${ROOT}/electron-builder.ci-mac-${arch}-signed.yml"
  else
    echo "${ROOT}/electron-builder.ci-mac-${arch}.yml"
  fi
}

ensure_duckdb_binding() {
  local arch="$1"
  local pkg="@duckdb/node-bindings-darwin-${arch}"
  if [[ -f "${ROOT}/node_modules/${pkg}/duckdb.node" ]]; then
    return
  fi
  echo "→ Installing ${pkg} for ${arch} packaging"
  npm install --no-save "${pkg}@${DUCKDB_BINDINGS_VERSION}"
}

rebuild_keytar_for_arch() {
  local arch="$1"
  local electron_version
  electron_version="$(node -p "require('electron/package.json').version")"
  echo "→ Rebuilding keytar for darwin-${arch} (Electron ${electron_version})"
  rm -rf "${ROOT}/node_modules/keytar/build"
  npx @electron/rebuild --force --only keytar \
    --arch "$arch" \
    --platform darwin \
    --version "$electron_version"
}

build_dmg() {
  local arch="${1//[[:space:]]/}"
  local config_file

  case "$arch" in
    arm64|x64) ;;
    *)
      echo "Unsupported macOS arch: $1" >&2
      exit 1
      ;;
  esac

  config_file="$(config_for_arch "$arch")"
  if [[ ! -f "$config_file" ]]; then
    echo "Missing electron-builder config: $config_file" >&2
    exit 1
  fi

  echo "→ Packaging macOS ${arch} DMG"
  ensure_duckdb_binding "$arch"
  rebuild_keytar_for_arch "$arch"

  echo "→ electron-builder --mac -c ${config_file} --publish never"
  (
    cd "$ROOT"
    "$ELECTRON_BUILDER" --mac -c "$config_file" --publish never "$@"
  )
}

# MAC_BUILD_ARCH: space-separated list (default: arm64 x64). CI sets one arch per job.
ARCHES="${MAC_BUILD_ARCH:-arm64 x64}"
for arch in $ARCHES; do
  build_dmg "$arch"
done

bash "${ROOT}/scripts/verify-mac-native.sh"
