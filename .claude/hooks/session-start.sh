#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code on the web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

echo "=== ScriptForge AI: installing dependencies ==="

echo "[1/2] Python backend deps..."
pip install -q -r "${CLAUDE_PROJECT_DIR}/backend/requirements.txt"

echo "[2/2] Frontend npm deps..."
cd "${CLAUDE_PROJECT_DIR}/frontend" && npm install --prefer-offline --no-audit --no-fund

echo "=== Setup complete ==="
