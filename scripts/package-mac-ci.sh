#!/usr/bin/env bash
# macOS packaging for CI and local release builds.
# Builds arm64 and x64 DMGs separately so native modules (keytar, duckdb) match each arch.
# GitHub Actions passes missing secrets as empty strings; CSC_LINK="" makes electron-builder
# treat the repo root as a certificate path and fail.
set -euo pipefail

DUCKDB_BINDINGS_VERSION="1.5.3-r.3"
EB_ARGS=(--publish never)

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
  EB_ARGS+=(
    --config.mac.hardenedRuntime=false
    --config.mac.gatekeeperAssess=false
  )
fi

ensure_duckdb_binding() {
  local arch="$1"
  local pkg="@duckdb/node-bindings-darwin-${arch}"
  if [[ -f "node_modules/${pkg}/duckdb.node" ]]; then
    return
  fi
  echo "→ Installing ${pkg} for ${arch} packaging"
  npm install --no-save "${pkg}@${DUCKDB_BINDINGS_VERSION}"
}

build_dmg() {
  local arch="$1"
  echo "→ Packaging macOS ${arch} DMG"
  ensure_duckdb_binding "$arch"
  npx electron-builder --mac dmg "--${arch}" "${EB_ARGS[@]}" "$@"
}

# Separate invocations so @electron/rebuild produces the correct keytar.node per arch.
build_dmg arm64
build_dmg x64
