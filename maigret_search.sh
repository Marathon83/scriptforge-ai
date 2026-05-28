#!/usr/bin/env bash

set -euo pipefail

TARGETS=(
    "rlink285@gmail.com"
    "rlink91"
    "rustiehuffman@yahoo.com"
    "rustielinkous@icloud.com"
    "rustielinkous@gmail.com"
)

OUTPUT_DIR="./maigret_reports"
mkdir -p "$OUTPUT_DIR"

echo "[*] Starting Maigret searches..."
echo "[*] Reports will be saved to: $OUTPUT_DIR"
echo ""

for TARGET in "${TARGETS[@]}"; do
    SAFE_NAME="${TARGET//@/_at_}"
    SAFE_NAME="${SAFE_NAME//./_}"
    REPORT_DIR="$OUTPUT_DIR/$SAFE_NAME"
    mkdir -p "$REPORT_DIR"

    echo "[*] Searching: $TARGET"
    maigret "$TARGET" \
        --top-sites 500 \
        --retries 2 \
        --html \
        -o "$REPORT_DIR" \
        || echo "[!] maigret exited non-zero for $TARGET (may still have partial results)"

    echo "[+] Done: $TARGET -> $REPORT_DIR"
    echo ""
done

echo "[*] All searches complete."
echo "[*] Open reports:"
find "$OUTPUT_DIR" -name "*.html" | sort
