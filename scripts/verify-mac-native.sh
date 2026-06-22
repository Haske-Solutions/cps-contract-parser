#!/usr/bin/env bash
# Fail CI if packaged .app bundles contain keytar/duckdb for the wrong CPU architecture.
set -euo pipefail

expected_keytar_arch() {
  case "$1" in
    mac-arm64) echo "arm64" ;;
    mac) echo "x86_64" ;;
    *)
      echo "Unknown app output folder: $1" >&2
      exit 1
      ;;
  esac
}

verify_keytar() {
  local app_root="$1"
  local expected="$2"
  local keytar
  keytar="$(find "$app_root" -path '*/keytar/build/Release/keytar.node' -print -quit)"
  if [[ -z "$keytar" ]]; then
    echo "Missing keytar.node under $app_root" >&2
    exit 1
  fi
  local info
  info="$(file "$keytar")"
  if [[ "$info" != *"$expected"* ]]; then
    echo "keytar architecture mismatch in $app_root" >&2
    echo "  expected substring: $expected" >&2
    echo "  file output:        $info" >&2
    exit 1
  fi
  echo "keytar OK ($expected): $keytar"
}

verify_duckdb() {
  local app_root="$1"
  local duckdb
  duckdb="$(find "$app_root" -path '*/@duckdb/*' -name 'duckdb.node' -print -quit)"
  if [[ -z "$duckdb" ]]; then
    echo "Missing duckdb.node under $app_root" >&2
    exit 1
  fi
  echo "duckdb OK: $duckdb"
}

# Only verify app folders produced in this run (supports single-arch CI jobs).
for out_dir in release/mac-arm64 release/mac; do
  app="${out_dir}/CPS Contract Parser.app"
  [[ -d "$app" ]] || continue
  folder="$(basename "$out_dir")"
  verify_keytar "$app" "$(expected_keytar_arch "$folder")"
  verify_duckdb "$app"
done

# Ensure at least one mac app was packaged.
if ! compgen -G "release/mac*/CPS Contract Parser.app" > /dev/null; then
  echo "No packaged macOS .app found under release/" >&2
  exit 1
fi

echo "macOS native module verification passed."
