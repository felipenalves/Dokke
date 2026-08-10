#!/usr/bin/env bash
# Build a drag-to-install DMG with Dokke.app and an Applications shortcut.
# Usage: ./package-dmg.sh [output.dmg]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Dokke"
OUTPUT="${1:-${ROOT}/dist/Dokke-macOS.dmg}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/dokke-dmg.XXXXXX")"
STAGE="${WORKSPACE}/contents"
WORK_DMG="${WORKSPACE}/Dokke-rw.dmg"
MOUNT_POINT=""

cleanup() {
  if [[ -n "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -force >/dev/null 2>&1 || true
  fi
  rm -rf "${WORKSPACE}"
}
trap cleanup EXIT

"${ROOT}/install.sh" --build-only >/dev/null
mkdir -p "${STAGE}" "$(dirname "${OUTPUT}")"
cp -R "${ROOT}/dist/${APP_NAME}.app" "${STAGE}/${APP_NAME}.app"
ln -s /Applications "${STAGE}/Applications"

echo "==> create DMG stage"
hdiutil create -volname "${APP_NAME}" -srcfolder "${STAGE}" -ov -format UDRW "${WORK_DMG}" >/dev/null
MOUNT_POINT="$(hdiutil attach "${WORK_DMG}" -nobrowse -noautoopen | awk '$NF ~ /^\/Volumes\// { print $NF; exit }')"
if [[ -z "${MOUNT_POINT}" || ! -d "${MOUNT_POINT}" ]]; then
  echo "error: DMG mount point not found" >&2
  exit 1
fi

echo "==> arrange Finder window"
osascript <<'APPLESCRIPT'
tell application "Finder"
  delay 1
  tell disk "Dokke"
    open
    tell container window
      set current view to icon view
      set bounds to {120, 120, 760, 520}
      set position of item "Dokke.app" to {190, 210}
      set position of item "Applications" to {570, 210}
    end tell
    update without registering applications
    close
  end tell
end tell
APPLESCRIPT

hdiutil detach "${MOUNT_POINT}" -force >/dev/null
MOUNT_POINT=""

echo "==> compress DMG"
hdiutil convert "${WORK_DMG}" -format UDZO -imagekey zlib-level=9 -ov -o "${OUTPUT}" >/dev/null
echo "OK ${OUTPUT}"
