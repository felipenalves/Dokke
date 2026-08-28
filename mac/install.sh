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
MAX_BUNDLE_SIZE_MB=121
VERIFY_BUNDLE=""

find_actool() {
  local candidate help_output
  local -a candidates=()

  if [[ -n "${DOKKE_ACTOOL:-}" ]]; then
    candidates+=("${DOKKE_ACTOOL}")
  fi
  if [[ -n "${DEVELOPER_DIR:-}" ]]; then
    candidates+=("${DEVELOPER_DIR}/usr/bin/actool")
  fi
  candidate="$(xcrun --find actool 2>/dev/null || true)"
  if [[ -n "${candidate}" ]]; then
    candidates+=("${candidate}")
  fi
  candidates+=("/Applications/Xcode.app/Contents/Developer/usr/bin/actool")

  for candidate in "${candidates[@]}"; do
    [[ -x "${candidate}" ]] || continue
    help_output="$("${candidate}" --help 2>&1 || true)"
    if [[ "${help_output}" == *"actool"* && "${help_output}" != *"requires Xcode"* ]]; then
      printf '%s' "${candidate}"
      return 0
    fi
  done
  return 1
}

validate_bundle_budget() {
  local bundle_path="$1" node_count bundle_kib max_bundle_kib
  if [[ ! -d "${bundle_path}" ]]; then
    echo "error: bundle not found: ${bundle_path}" >&2
    exit 1
  fi

  node_count="$(find "${bundle_path}/Contents/Resources" -type f -path '*/node-bin/node' -perm -111 | wc -l | tr -d '[:space:]')"
  if [[ "${node_count}" -ne 1 ]]; then
    echo "error: expected exactly one embedded Node runtime, found ${node_count}" >&2
    exit 1
  fi

  bundle_kib="$(du -sk "${bundle_path}" | awk '{print $1}')"
  max_bundle_kib="$((MAX_BUNDLE_SIZE_MB * 1024))"
  if [[ "${bundle_kib}" -gt "${max_bundle_kib}" ]]; then
    echo "error: Dokke.app is ${bundle_kib} KiB; budget is ${MAX_BUNDLE_SIZE_MB} MiB" >&2
    exit 1
  fi
  echo "==> bundle budget OK (${bundle_kib} KiB <= ${MAX_BUNDLE_SIZE_MB} MiB; one Node runtime)"
}

for arg in "$@"; do
  case "$arg" in
    --system) DEST_DIR="/Applications" ;;
    --open) OPEN_AFTER=1 ;;
    --build-only) BUILD_ONLY=1 ;;
    --verify-bundle=*) VERIFY_BUNDLE="${arg#--verify-bundle=}" ;;
    -h|--help)
      echo "Usage: ./install.sh [--open] [--system] [--build-only] [--verify-bundle=PATH]"
      exit 0
      ;;
  esac
done

if [[ -n "${VERIFY_BUNDLE}" ]]; then
  validate_bundle_budget "${VERIFY_BUNDLE}"
  exit 0
fi

echo "==> release build (${BIN_NAME})"
cd "${ROOT}"
swift build -c release --product "${BIN_NAME}"
swift build -c debug --product "DokkeIconHelper"

BIN_PATH="$(swift build -c release --show-bin-path)/${BIN_NAME}"
if [[ ! -x "${BIN_PATH}" ]]; then
  echo "error: missing binary: ${BIN_PATH}" >&2
  exit 1
fi
# O binário release não precisa carregar símbolos locais para distribuição.
# Removê-los reduz o app sem alterar o executável ou o comportamento do host.
if command -v strip >/dev/null 2>&1; then
  strip -x "${BIN_PATH}"
fi
ICON_HELPER_PATH="$(swift build -c debug --show-bin-path)/DokkeIconHelper"
if [[ ! -x "${ICON_HELPER_PATH}" ]]; then
  echo "error: missing icon helper: ${ICON_HELPER_PATH}" >&2
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
# O .icns mantém compatibilidade com sistemas anteriores ao Icon Composer.
if [[ -f "${ROOT}/AppIcon.icns" ]]; then
  cp "${ROOT}/AppIcon.icns" "${APP_BUNDLE}/Contents/Resources/Dokke.icns"
else
  echo "error: legacy icon missing: ${ROOT}/AppIcon.icns" >&2
  exit 1
fi

# The raw .icon source is compiled by actool into Assets.car and is not copied into the final bundle;
# shipping the source package alone can make the system show a generic placeholder.
ICON_SOURCE="${ROOT}/../assets/branding/dokke-icon/Dokke.icon"
ACTOOL="$(find_actool || true)"
if [[ ! -d "${ICON_SOURCE}" ]]; then
  echo "error: Icon Composer source missing: ${ICON_SOURCE}" >&2
  exit 1
elif [[ -n "${ACTOOL}" ]]; then
  echo "==> compile adaptive icon (${ACTOOL})"
  "${ACTOOL}" "${ICON_SOURCE}" \
    --compile "${APP_BUNDLE}/Contents/Resources" \
    --app-icon Dokke \
    --enable-on-demand-resources NO \
    --development-region pt-BR \
    --target-device mac \
    --platform macosx \
    --minimum-deployment-target 14.0 \
    --enable-icon-stack-fallback-generation=disabled \
    --include-all-app-icons \
    --errors --warnings \
    --output-partial-info-plist /dev/null
else
  echo "warn: actool ausente — usando Dokke.icns; o ícone adaptativo exige Xcode 26."
fi

# pack do server no bundle (Contents/Resources/Dokke/) — sem isso o app instalado
# não acha o server.js (cwd do Launchpad é /) e o dock morre offline.
SRV_DIR="${APP_BUNDLE}/Contents/Resources/Dokke"
mkdir -p "${SRV_DIR}"
cp "${ROOT}/../server.js" "${ROOT}/../apps.js" "${ROOT}/../actions.js" "${ROOT}/../config.js" "${ROOT}/../config.json" "${ROOT}/../auth.js" "${ROOT}/../obs.js" "${ROOT}/../obs-ws.js" "${SRV_DIR}/"
ICON_HELPER_APP="${SRV_DIR}/bin/DokkeIconHelper.app"
mkdir -p "${ICON_HELPER_APP}/Contents/MacOS" "${ICON_HELPER_APP}/Contents/Resources"
cp "${ICON_HELPER_PATH}" "${ICON_HELPER_APP}/Contents/MacOS/DokkeIconHelper"
cp "${ROOT}/IconHelper/Info.plist" "${ICON_HELPER_APP}/Contents/Info.plist"
chmod +x "${ICON_HELPER_APP}/Contents/MacOS/DokkeIconHelper"

# Keep the server bundle explicit. `public/` can contain ignored backups,
# logs, and local build output that must never become public app content.
PUBLIC_FILES=(
  "index.html"
  "manifest.webmanifest"
  "sw.js"
  "icon-192.png"
  "icon-192-dark.png"
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
  echo "error: nenhum node relocável encontrado para o bundle" >&2
  exit 1
fi

validate_bundle_budget "${APP_BUNDLE}"

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
