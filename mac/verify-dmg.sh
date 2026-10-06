#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 PATH_TO_DMG arm64|x86_64|universal" >&2
  exit 2
fi

DMG_PATH="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
EXPECTED_ARCH="$2"
case "${EXPECTED_ARCH}" in
  arm64|x86_64|universal) ;;
  *) echo "error: unsupported architecture: ${EXPECTED_ARCH}" >&2; exit 2 ;;
esac

DMG_NAME="$(basename "${DMG_PATH}")"
CHECKSUM_NAME="${DMG_NAME}.sha256"
SCRIPT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE="$(mktemp -d "${TMPDIR:-/tmp}/dokke-dmg-verify.XXXXXX")"
MOUNT_POINT=""

cleanup() {
  if [[ -n "${MOUNT_POINT}" ]]; then
    hdiutil detach "${MOUNT_POINT}" -force >/dev/null 2>&1 || true
  fi
  rm -rf "${WORKSPACE}"
}
trap cleanup EXIT

if [[ ! -f "${DMG_PATH}" || ! -f "${DMG_PATH}.sha256" ]]; then
  echo "error: DMG and checksum must both exist beside each other" >&2
  exit 1
fi

echo "==> verify checksum and disk image"
(cd "$(dirname "${DMG_PATH}")" && shasum -a 256 -c "${CHECKSUM_NAME}")
hdiutil verify "${DMG_PATH}"

echo "==> mount DMG read-only"
if ! ATTACH_OUTPUT="$(hdiutil attach "${DMG_PATH}" -readonly -nobrowse -noautoopen 2>&1)"; then
  echo "error: failed to mount DMG: ${ATTACH_OUTPUT}" >&2
  exit 1
fi
MOUNT_POINT="$(printf '%s\n' "${ATTACH_OUTPUT}" | sed -n 's#^.*\(/Volumes/.*\)$#\1#p' | tail -n 1)"
if [[ -z "${MOUNT_POINT}" || ! -d "${MOUNT_POINT}" ]]; then
  echo "error: failed to mount DMG: ${ATTACH_OUTPUT}" >&2
  exit 1
fi

APP_BUNDLE="${MOUNT_POINT}/Dokke.app"
MAIN_BINARY="${APP_BUNDLE}/Contents/MacOS/Dokke"
ICON_HELPER="${APP_BUNDLE}/Contents/Resources/Dokke/bin/DokkeIconHelper.app/Contents/MacOS/DokkeIconHelper"
NODE_BINARY="${APP_BUNDLE}/Contents/Resources/node-bin/node"

verify_architecture() {
  local binary_path="$1" actual_arch actual_count
  if [[ ! -x "${binary_path}" ]]; then
    echo "error: packaged executable missing: ${binary_path}" >&2
    exit 1
  fi
  actual_arch="$(lipo -archs "${binary_path}")"
  if [[ "${EXPECTED_ARCH}" == universal ]]; then
    actual_count="$(wc -w <<< "${actual_arch}" | tr -d '[:space:]')"
    if [[ "${actual_count}" != 2 \
       || " ${actual_arch} " != *" x86_64 "* \
       || " ${actual_arch} " != *" arm64 "* ]]; then
      echo "error: ${binary_path} has architecture(s) ${actual_arch}; expected x86_64 and arm64 only" >&2
      exit 1
    fi
  elif [[ "${actual_arch}" != "${EXPECTED_ARCH}" ]]; then
    echo "error: ${binary_path} has architecture ${actual_arch}; expected ${EXPECTED_ARCH}" >&2
    exit 1
  fi
  echo "OK ${binary_path##*/}: ${actual_arch}"
}

verify_architecture "${MAIN_BINARY}"
verify_architecture "${ICON_HELPER}"
verify_architecture "${NODE_BINARY}"

if [[ "${DOKKE_SKIP_RUNTIME_SMOKE:-0}" == 1 ]]; then
  echo "SKIP packaged server runtime smoke (DOKKE_SKIP_RUNTIME_SMOKE=1)"
else
  echo "==> smoke-test packaged Dokke server with its embedded Node"
  "${NODE_BINARY}" "${SCRIPT_ROOT}/mac/smoke-packaged-server.mjs" "${APP_BUNDLE}"
fi
