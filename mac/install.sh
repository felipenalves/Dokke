#!/usr/bin/env bash
# Build Dokke as a real .app and install once (default: ~/Applications).
# Does NOT leave a second .app under mac/dist (avoids Launchpad duplicate).
# Usage:
#   ./install.sh
#   ./install.sh --open
#   ./install.sh --system
#   ./install.sh --build-only   # writes only mac/dist then exits (dev)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="Dokke"
BIN_NAME="Dokke"
DEST_DIR="${HOME}/Applications"
OPEN_AFTER=0
BUILD_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --system) DEST_DIR="/Applications" ;;
    --open) OPEN_AFTER=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    -h|--help)
      echo "Usage: ./install.sh [--open] [--system] [--build-only]"
      exit 0
      ;;
  esac
done

echo "==> release build (${BIN_NAME})"
cd "${ROOT}"
swift build -c release --product "${BIN_NAME}"

BIN_PATH="$(swift build -c release --show-bin-path)/${BIN_NAME}"
if [[ ! -x "${BIN_PATH}" ]]; then
  echo "error: missing binary: ${BIN_PATH}" >&2
  exit 1
fi

# pack in a private temp dir so Spotlight never sees two copies
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/dokke-app.XXXXXX")"
cleanup() { rm -rf "${STAGE}"; }
trap cleanup EXIT

APP_BUNDLE="${STAGE}/${APP_NAME}.app"
echo "==> pack ${APP_NAME}.app"
mkdir -p "${APP_BUNDLE}/Contents/MacOS"
mkdir -p "${APP_BUNDLE}/Contents/Resources"
cp "${BIN_PATH}" "${APP_BUNDLE}/Contents/MacOS/${BIN_NAME}"
chmod +x "${APP_BUNDLE}/Contents/MacOS/${BIN_NAME}"
cp "${ROOT}/Info.plist" "${APP_BUNDLE}/Contents/Info.plist"
cp "${ROOT}/AppIcon.icns" "${APP_BUNDLE}/Contents/Resources/AppIcon.icns" 2>/dev/null || true

# pack do server no bundle (Contents/Resources/Dokke/) — sem isso o app instalado
# não acha o server.js (cwd do Launchpad é /) e o dock morre offline.
SRV_DIR="${APP_BUNDLE}/Contents/Resources/Dokke"
mkdir -p "${SRV_DIR}"
cp "${ROOT}/../server.js" "${ROOT}/../apps.js" "${ROOT}/../actions.js" "${ROOT}/../config.js" "${ROOT}/../auth.js" "${ROOT}/../obs.js" "${ROOT}/../obs-ws.js" "${SRV_DIR}/"
cp -R "${ROOT}/../public" "${SRV_DIR}/public"
cp "${ROOT}/../package.json" "${ROOT}/../package-lock.json" "${SRV_DIR}/"
if command -v npm >/dev/null 2>&1; then
  (cd "${SRV_DIR}" && npm ci --omit=dev >/dev/null 2>&1) \
    || echo "warn: npm ci falhou — server pode não subir (dependência ws ausente)"
elif [ -d "${ROOT}/../node_modules" ]; then
  cp -R "${ROOT}/../node_modules" "${SRV_DIR}/node_modules"
else
  echo "warn: npm/node_modules ausentes — server pode não subir (dependência ws ausente)"
fi

# embute o node no bundle (Contents/Resources/node-bin) — o app roda em Mac
# sem Node instalado; o ServerManager.locateNode olha o bundle primeiro.
NODE_SRC="$(command -v node || true)"
if [[ -n "${NODE_SRC}" ]]; then
  mkdir -p "${APP_BUNDLE}/Contents/Resources/node-bin"
  cp -L "${NODE_SRC}" "${APP_BUNDLE}/Contents/Resources/node-bin/node"
  chmod +x "${APP_BUNDLE}/Contents/Resources/node-bin/node"
  echo "==> node embutido ($(du -sh "${APP_BUNDLE}/Contents/Resources/node-bin/node" | cut -f1))"
else
  echo "warn: node não encontrado no sistema — o app usará o node do Mac (se existir)"
fi

if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${APP_BUNDLE}"
  codesign --verify --deep --strict "${APP_BUNDLE}" || { echo "error: assinatura inválida após codesign" >&2; exit 1; }
fi

if [[ "${BUILD_ONLY}" -eq 1 ]]; then
  DIST="${ROOT}/dist"
  mkdir -p "${DIST}"
  rm -rf "${DIST}/${APP_NAME}.app"
  cp -R "${APP_BUNDLE}" "${DIST}/${APP_NAME}.app"
  echo "OK ${DIST}/${APP_NAME}.app (dev only — not installed)"
  exit 0
fi

# drop any leftover dist copy that Launchpad/Spotlight would list twice
rm -rf "${ROOT}/dist/${APP_NAME}.app"

mkdir -p "${DEST_DIR}"
INSTALL_PATH="${DEST_DIR}/${APP_NAME}.app"
echo "==> install ${INSTALL_PATH}"
rm -rf "${INSTALL_PATH}"
rm -rf "${DEST_DIR}/Dokke.app" 2>/dev/null || true
cp -R "${APP_BUNDLE}" "${INSTALL_PATH}"

if command -v xattr >/dev/null 2>&1; then
  xattr -dr com.apple.quarantine "${INSTALL_PATH}" 2>/dev/null || true
fi

echo "OK installed: ${INSTALL_PATH}"
echo "Only one copy. Open via Spotlight: Dokke"

if [[ "${OPEN_AFTER}" -eq 1 ]]; then
  open "${INSTALL_PATH}"
fi
