#!/usr/bin/env bash

set -euo pipefail

SOURCE_DIR="/Users/benni/Documents"
OUTPUT_DIR="/Users/benni/Desktop/app-store-screenshots"

mkdir -p "$OUTPUT_DIR"

found=0
for file in "$SOURCE_DIR"/Simulator\ Screenshot\ -\ iPhone\ 17\ Pro\ Max\ -\ *.png; do
  [[ -f "$file" ]] || continue

  name=$(basename "$file")
  sips -z 2688 1242 "$file" --out "$OUTPUT_DIR/$name"
  found=$((found + 1))
done

if [[ "$found" -eq 0 ]]; then
  echo "No iPhone 17 Pro Max simulator screenshots found in $SOURCE_DIR" >&2
  exit 1
fi

echo "Prepared $found screenshot(s) in $OUTPUT_DIR"
