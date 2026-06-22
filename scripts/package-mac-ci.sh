#!/usr/bin/env bash
# macOS packaging for CI and local release builds.
# Builds one or both DMGs with native modules (keytar, duckdb) matching the target CPU.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ELECTRON_BUILDER="${ROOT}/node_modules/.bin/electron-builder"
DUCKDB_BINDINGS_VERSION="1.5.3-r.3"
EB_ARGS=(--publish never)

if [[ -n "${CSC_LINK_RAW:-}" ]]; then
  echo "→ Apple signing identity configured; building signed macOS apps"
  export CSC_LINK="$CSC_LINK_RAW"
  export CSC_KEY_PASSWORD="${CSC_KEY_PASSWORD_RAW:-}"
  export APPLE_ID="${APPLE_ID_RAW:-}"
  export APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD_RAW:-}"
  export APPLE_TEAM_ID="${APPLE_TEAM_ID_RAW:-}"
  CONFIG_ARGS=()
else
  echo "→ No CSC_LINK secret; building unsigned macOS apps"
  echo "  (Users may need right-click → Open on first launch.)"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  CONFIG_ARGS=(-c "${ROOT}/electron-builder.unsigned.yml")
fi

if [[ ! -x "$ELECTRON_BUILDER" ]]; then
  echo "electron-builder not found at ${ELECTRON_BUILDER}. Run npm ci first." >&2
  exit 1
fi

echo "→ Using $("$ELECTRON_BUILDER" --version)"

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
  local -a arch_flag=()

  case "$arch" in
    arm64) arch_flag=(--arm64) ;;
    x64) arch_flag=(--x64) ;;
    *)
      echo "Unsupported macOS arch: $1" >&2
      exit 1
      ;;
  esac

  echo "→ Packaging macOS ${arch} DMG"
  ensure_duckdb_binding "$arch"
  rebuild_keytar_for_arch "$arch"

  (
    cd "$ROOT"
    "$ELECTRON_BUILDER" build --mac "${arch_flag[@]}" "${CONFIG_ARGS[@]}" "${EB_ARGS[@]}" "$@"
  )
}

# MAC_BUILD_ARCH: space-separated list (default: arm64 x64). CI sets one arch per job.
ARCHES="${MAC_BUILD_ARCH:-arm64 x64}"
for arch in $ARCHES; do
  build_dmg "$arch"
done

bash "${ROOT}/scripts/verify-mac-native.sh"
