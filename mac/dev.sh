#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
SDK_PATH="${DOKKE_SDK:-}"
if [[ -z "${SDK_PATH}" && -d "/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk" ]]; then
  SDK_PATH="/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk"
fi

if [[ -n "${SDK_PATH}" ]]; then
  exec swift run --sdk "${SDK_PATH}" --package-path mac Dokke "$@"
fi

exec swift run --package-path mac Dokke "$@"
