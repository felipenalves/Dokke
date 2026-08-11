#!/usr/bin/env bash
# Build a drag-to-install DMG with Dokke.app and an Applications shortcut.
# Usage: ./package-dmg.sh [output.dmg]
set -euo pipefail

MAC_ROOT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${MAC_ROOT}/.." && pwd)"
APP_NAME="Dokke"
OUTPUT="${1:-${MAC_ROOT}/dist/Dokke-macOS.dmg}"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/dokke-dmg.XXXXXX")"
TEMP_IMAGE="${WORKSPACE}/Dokke-raw.dmg"
MOUNT_POINT=""

cleanup() {
  if [[ -n "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -force >/dev/null 2>&1 || true
  fi
  rm -rf "${WORKSPACE}"
}
trap cleanup EXIT

for command_name in hdiutil node swift; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "error: ${command_name} is required to build the DMG" >&2
    exit 1
  fi
done

cd "${PROJECT_ROOT}"
"${MAC_ROOT}/install.sh" --build-only >/dev/null

APP_BUNDLE="${MAC_ROOT}/dist/${APP_NAME}.app"
if [[ ! -d "${APP_BUNDLE}" || ! -x "${APP_BUNDLE}/Contents/MacOS/${APP_NAME}" ]]; then
  echo "error: built app bundle is missing or not executable" >&2
  exit 1
fi
if [[ ! -f "${APP_BUNDLE}/Contents/Resources/Dokke/server.js" ]]; then
  echo "error: server.js is missing from the app bundle" >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT}")"
echo "==> create DMG staging image"
hdiutil create "${TEMP_IMAGE}" -ov -fs HFS+ -size 200m -volname "Dokke Installer" >/dev/null

ATTACH_OUTPUT="$(hdiutil attach "${TEMP_IMAGE}" -nobrowse -noautoopen 2>&1)"
MOUNT_POINT="$(printf '%s\n' "${ATTACH_OUTPUT}" | sed -n 's#.*\(/Volumes/.*\)$#\1#p' | tail -n 1)"
if [[ -z "${MOUNT_POINT}" || ! -d "${MOUNT_POINT}" ]]; then
  echo "error: failed to mount staging image" >&2
  exit 1
fi

mkdir -p "${MOUNT_POINT}/.background"
cp "${MAC_ROOT}/dmg-background.png" "${MOUNT_POINT}/.background/dmg-background.png"
cp -R "${APP_BUNDLE}" "${MOUNT_POINT}/${APP_NAME}.app"
ln -s /Applications "${MOUNT_POINT}/Applications"

node "${MAC_ROOT}/write-dmg-ds-store.mjs" "${MOUNT_POINT}"
if command -v bless >/dev/null 2>&1; then
  bless_args=(--folder "${MOUNT_POINT}")
  if [[ "$(uname -m)" != "arm64" ]]; then
    bless_args+=(--openfolder "${MOUNT_POINT}")
  fi
  bless "${bless_args[@]}"
fi

hdiutil detach "${MOUNT_POINT}" >/dev/null
MOUNT_POINT=""

echo "==> compress DMG"
hdiutil convert "${TEMP_IMAGE}" -ov -format UDZO -imagekey zlib-level=9 -o "${OUTPUT}" >/dev/null
echo "OK ${OUTPUT}"
