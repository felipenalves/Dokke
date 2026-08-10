#!/usr/bin/env bash
# Build a drag-to-install DMG with Dokke.app and an Applications shortcut.
# Usage: ./package-dmg.sh [output.dmg]
set -euo pipefail

MAC_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${MAC_ROOT}/.." && pwd)"
APP_NAME="Dokke"
OUTPUT="${1:-${MAC_ROOT}/dist/Dokke-macOS.dmg}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/dokke-dmg.XXXXXX")"
SPEC="${WORKSPACE}/appdmg.json"

cleanup() {
  rm -rf "${WORKSPACE}"
}
trap cleanup EXIT

if [[ ! -x "${PROJECT_ROOT}/node_modules/.bin/appdmg" ]]; then
  echo "error: appdmg is not installed; run npm install first" >&2
  exit 1
fi

cd "${PROJECT_ROOT}"
"${MAC_ROOT}/install.sh" --build-only >/dev/null
mkdir -p "$(dirname "${OUTPUT}")"

APP_BUNDLE="${MAC_ROOT}/dist/${APP_NAME}.app"
if [[ ! -d "${APP_BUNDLE}" || ! -x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}" ]]; then
  echo "error: built app bundle is missing or not executable" >&2
  exit 1
fi
if [[ ! -f "${APP_BUNDLE}/Contents/Resources/Dokke/server.js" ]]; then
  echo "error: server.js is missing from the app bundle" >&2
  exit 1
fi

# npm 11 can leave native optional build scripts pending. appdmg needs its
# alias helper to write the background reference into the volume .DS_Store.
if ! node -e "const alias = require('macos-alias'); alias.create(process.argv[1])" "${MAC_ROOT}/dmg-background.png" >/dev/null 2>&1; then
  echo "==> build DMG metadata helper"
  npm rebuild --silent macos-alias fs-xattr
fi

node --input-type=module - "${SPEC}" "${MAC_ROOT}/dmg-background.png" "${APP_BUNDLE}" <<'NODE'
import fs from 'node:fs';

const specPath = process.argv[2];
const backgroundPath = process.argv[3];
const appBundlePath = process.argv[4];

const spec = {
  title: 'Dokke Installer',
  format: 'UDZO',
  background: backgroundPath,
  'icon-size': 96,
  window: {
    position: { x: 120, y: 120 },
    // appdmg adds the 22pt title bar to this value: 378 + 22 = 400.
    size: { width: 640, height: 378 }
  },
  contents: [
    { x: 170, y: 210, type: 'file', path: appBundlePath },
    { x: 570, y: 210, type: 'link', path: '/Applications' }
  ]
};

fs.writeFileSync(specPath, JSON.stringify(spec));
NODE

echo "==> build DMG layout"
"${PROJECT_ROOT}/node_modules/.bin/appdmg" "${SPEC}" "${OUTPUT}"
echo "OK ${OUTPUT}"
