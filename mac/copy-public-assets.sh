#!/usr/bin/env bash
set -euo pipefail

if [[ "$#" -ne 2 ]]; then
  echo "usage: copy-public-assets.sh <public-source> <bundle-destination>" >&2
  exit 2
fi

SOURCE_DIR="$1"
DEST_DIR="$2"
PUBLIC_FILES=(
  "index.html"
  "manifest.webmanifest"
  "sw.js"
  "icon-192.png"
  "icon-192-dark.png"
  "icon-512.png"
  "version.json"
  "dokke.apk"
  "fonts/Inter-Regular.otf"
  "fonts/Inter-SemiBold.otf"
)

mkdir -p "$DEST_DIR"
for public_file in "${PUBLIC_FILES[@]}"; do
  source_file="${SOURCE_DIR}/${public_file}"
  target_file="${DEST_DIR}/${public_file}"
  if [[ ! -f "$source_file" ]]; then
    echo "error: required public asset is missing: ${source_file}" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$target_file")"
  cp "$source_file" "$target_file"
done
