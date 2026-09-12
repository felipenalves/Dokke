#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
SDK_PATH="${DOKKE_SDK:-}"
if [[ -n "${SDK_PATH}" && ! -d "${SDK_PATH}" ]]; then
  echo "error: DOKKE_SDK não existe: ${SDK_PATH}" >&2
  exit 1
fi
if [[ -z "${SDK_PATH}" ]]; then
  for candidate in \
    "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" \
    "/Library/Developer/CommandLineTools/SDKs/MacOSX26.sdk" \
    /Library/Developer/CommandLineTools/SDKs/MacOSX26*.sdk; do
    if [[ -d "${candidate}" ]]; then
      SDK_PATH="${candidate}"
      break
    fi
  done
fi
if [[ -z "${SDK_PATH}" ]]; then
  echo "warn: SDK MacOS 26.x não encontrado; usando o SDK padrão do Swift. Se SwiftUIMacros falhar, defina DOKKE_SDK para um SDK compatível." >&2
fi

if [[ -n "${SDK_PATH}" ]]; then
  exec swift run --sdk "${SDK_PATH}" --package-path mac Dokke "$@"
fi

exec swift run --package-path mac Dokke "$@"
