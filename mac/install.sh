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

# Keep the server bundle explicit. `public/` can contain ignored backups,
# logs, and local build output that must never become public app content.
PUBLIC_FILES=(
  "index.html"
  "manifest.webmanifest"
  "sw.js"
  "icon-192.png"
  "icon-512.png"
  "version.json"
  "dokke.apk"
)
mkdir -p "${SRV_DIR}/public"
for public_file in "${PUBLIC_FILES[@]}"; do
  source_file="${ROOT}/../public/${public_file}"
  if [[ ! -f "${source_file}" ]]; then
    echo "error: required public asset is missing: ${source_file}" >&2
    exit 1
  fi
  cp "${source_file}" "${SRV_DIR}/public/${public_file}"
done
cp "${ROOT}/../package.json" "${ROOT}/../package-lock.json" "${SRV_DIR}/"
if command -v npm >/dev/null 2>&1; then
  (cd "${SRV_DIR}" && npm ci --omit=dev >/dev/null 2>&1) \
    || echo "warn: npm ci falhou — server pode não subir (dependência ws ausente)"
elif [ -d "${ROOT}/../node_modules" ]; then
  cp -R "${ROOT}/../node_modules" "${SRV_DIR}/node_modules"
else
  echo "warn: npm/node_modules ausentes — server pode não subir (dependência ws ausente)"
fi

# embute um node relocável no bundle (Contents/Resources/node-bin) — o app
# roda em Mac sem Node instalado. Homebrew Node costuma depender de dylibs em
# /opt/homebrew/opt, então prefere uma cópia estática do nvm quando disponível.
find_relocatable_node() {
  local candidate
  local -a candidates=()
  local nvm_root="${NVM_DIR:-${HOME}/.nvm}/versions/node"

  if [[ -n "${DOKKE_NODE:-}" ]]; then
    candidates+=("${DOKKE_NODE}")
  fi
  if [[ -d "${nvm_root}" ]]; then
    while IFS= read -r candidate; do
      candidates+=("${candidate}")
    done < <(find "${nvm_root}" -type f -path '*/bin/node' -perm -111 2>/dev/null | sort -r)
  fi
  candidate="$(command -v node || true)"
  if [[ -n "${candidate}" ]]; then
    candidates+=("${candidate}")
  fi
  candidates+=("/opt/homebrew/bin/node" "/usr/local/bin/node")

  for candidate in "${candidates[@]}"; do
    [[ -x "${candidate}" ]] || continue
    if command -v otool >/dev/null 2>&1 && otool -L "${candidate}" | grep -Eq '(@rpath/libnode|/opt/homebrew/opt/|/usr/local/opt/)'; then
      continue
    fi
    if "${candidate}" --version >/dev/null 2>&1; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  return 1
}

NODE_SRC="$(find_relocatable_node || true)"
if [[ -n "${NODE_SRC}" ]]; then
  mkdir -p "${APP_BUNDLE}/Contents/Resources/node-bin"
  NODE_BIN="${APP_BUNDLE}/Contents/Resources/node-bin/node"
  cp -L "${NODE_SRC}" "${NODE_BIN}"
  chmod +x "${NODE_BIN}"
  if ! "${NODE_BIN}" --version >/dev/null 2>&1; then
    echo "error: node embutido não executa fora do ambiente de origem" >&2
    exit 1
  fi
  echo "==> node embutido (${NODE_SRC}; $(du -sh "${NODE_BIN}" | cut -f1))"
else
  echo "warn: nenhum node relocável encontrado — o app usará o node do Mac (se existir)"
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
