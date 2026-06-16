#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv-mac"
SPEC_FILE="$SCRIPT_DIR/scripts/WebDataExtractorLauncher_mac.spec"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$SCRIPT_DIR/scripts/requirements.txt"
"$VENV_DIR/bin/python" -m playwright install chromium

cd "$SCRIPT_DIR"
"$VENV_DIR/bin/python" -m PyInstaller --noconfirm --clean "$SPEC_FILE"

echo
echo "Build completed:"
echo "  $SCRIPT_DIR/dist/WebDataExtractorLauncher.app"
