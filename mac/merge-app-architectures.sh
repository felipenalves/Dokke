#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "Usage: $0 ARM64_APP X86_64_APP OUTPUT_APP" >&2
  exit 2
fi

ARM64_APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
X86_64_APP="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
OUTPUT_APP="$3"
if [[ "${OUTPUT_APP}" != /* ]]; then
  OUTPUT_APP="$(pwd)/${OUTPUT_APP}"
fi

if [[ ! -d "${ARM64_APP}" || ! -d "${X86_64_APP}" ]]; then
  echo "error: both architecture-specific app bundles must exist" >&2
  exit 1
fi
if [[ -e "${OUTPUT_APP}" ]]; then
  echo "error: output app bundle already exists: ${OUTPUT_APP}" >&2
  exit 1
fi

BINARIES=(
  "Contents/MacOS/Dokke"
  "Contents/Resources/Dokke/bin/DokkeIconHelper.app/Contents/MacOS/DokkeIconHelper"
  "Contents/Resources/node-bin/node"
)
MAX_UNIVERSAL_BUNDLE_MB=256

verify_source_architecture() {
  local binary_path="$1" expected_arch="$2" actual_arch
  if [[ ! -x "${binary_path}" ]]; then
    echo "error: packaged executable missing: ${binary_path}" >&2
    exit 1
  fi
  actual_arch="$(lipo -archs "${binary_path}")"
  if [[ "${actual_arch}" != "${expected_arch}" ]]; then
    echo "error: ${binary_path} has architecture ${actual_arch}; expected ${expected_arch}" >&2
    exit 1
  fi
}

for relative_path in "${BINARIES[@]}"; do
  verify_source_architecture "${ARM64_APP}/${relative_path}" arm64
  verify_source_architecture "${X86_64_APP}/${relative_path}" x86_64
done

mkdir -p "$(dirname "${OUTPUT_APP}")"
cp -R "${ARM64_APP}" "${OUTPUT_APP}"

for relative_path in "${BINARIES[@]}"; do
  output_binary="${OUTPUT_APP}/${relative_path}"
  temporary_binary="${output_binary}.universal"
  lipo -create \
    "${ARM64_APP}/${relative_path}" \
    "${X86_64_APP}/${relative_path}" \
    -output "${temporary_binary}"
  lipo "${temporary_binary}" -verify_arch x86_64
  lipo "${temporary_binary}" -verify_arch arm64
  chmod +x "${temporary_binary}"
  mv "${temporary_binary}" "${output_binary}"
done

bundle_kib="$(du -sk "${OUTPUT_APP}" | awk '{print $1}')"
max_bundle_kib="$((MAX_UNIVERSAL_BUNDLE_MB * 1024))"
if [[ "${bundle_kib}" -gt "${max_bundle_kib}" ]]; then
  echo "error: universal Dokke.app is ${bundle_kib} KiB; budget is ${MAX_UNIVERSAL_BUNDLE_MB} MiB" >&2
  exit 1
fi

codesign --force --deep --sign - "${OUTPUT_APP}"
codesign --verify --deep --strict "${OUTPUT_APP}"
echo "OK universal Dokke.app: ${OUTPUT_APP}"
