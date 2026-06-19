#!/usr/bin/env bash
# Generate resources/icon.icns and resources/icon.ico from resources/icon.png.
# Uses macOS sips/iconutil for .icns and png-to-ico (via npx) for .ico.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RES="$ROOT/resources"
SRC="$RES/icon.png"

if [[ ! -f "$SRC" ]]; then
  echo "Missing $SRC — add a 1024×1024 (or larger square) PNG first." >&2
  exit 1
fi

ICONSET="$RES/icon.iconset"

if [[ "$(uname)" == "Darwin" ]]; then
  echo "Generating icon.icns…"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  sips -z 16 16     "$SRC" --out "$ICONSET/icon_16x16.png" >/dev/null
  sips -z 32 32     "$SRC" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "$SRC" --out "$ICONSET/icon_32x32.png" >/dev/null
  sips -z 64 64     "$SRC" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "$SRC" --out "$ICONSET/icon_128x128.png" >/dev/null
  sips -z 256 256   "$SRC" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "$SRC" --out "$ICONSET/icon_256x256.png" >/dev/null
  sips -z 512 512   "$SRC" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "$SRC" --out "$ICONSET/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "$SRC" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
  xattr -cr "$ICONSET" 2>/dev/null || true
  iconutil -c icns "$ICONSET" -o "$RES/icon.icns"
  rm -rf "$ICONSET"
  echo "  → $RES/icon.icns"
else
  echo "Skipping icon.icns (requires macOS sips + iconutil)." >&2
fi

echo "Generating icon.ico…"
export ROOT
npx --yes -p png-to-ico node -e "
const fs = require('fs');
const path = require('path');
const pngToIco = require('png-to-ico').default;
const root = process.env.ROOT;
const src = path.join(root, 'resources/icon.png');
const out = path.join(root, 'resources/icon.ico');
pngToIco(src).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log('  → ' + out + ' (' + buf.length + ' bytes)');
}).catch((err) => { console.error(err); process.exit(1); });
"

echo "Done."
