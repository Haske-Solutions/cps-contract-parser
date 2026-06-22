#!/usr/bin/env bash
# macOS packaging for CI. GitHub Actions passes missing secrets as empty strings;
# electron-builder treats CSC_LINK="" as a cert file path (the repo root) and fails.
set -euo pipefail

if [[ -n "${CSC_LINK_RAW:-}" ]]; then
  echo "→ Apple signing identity configured; building signed macOS app"
  export CSC_LINK="$CSC_LINK_RAW"
  export CSC_KEY_PASSWORD="${CSC_KEY_PASSWORD_RAW:-}"
  export APPLE_ID="${APPLE_ID_RAW:-}"
  export APPLE_APP_SPECIFIC_PASSWORD="${APPLE_APP_SPECIFIC_PASSWORD_RAW:-}"
  export APPLE_TEAM_ID="${APPLE_TEAM_ID_RAW:-}"
  npx electron-builder --mac --publish never "$@"
else
  echo "→ No CSC_LINK secret; building unsigned macOS app"
  echo "  (Users may need right-click → Open on first launch.)"
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  npx electron-builder --mac --publish never \
    --config.mac.hardenedRuntime=false \
    --config.mac.gatekeeperAssess=false \
    "$@"
fi
