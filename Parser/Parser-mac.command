#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv-mac"
REQ_FILE="$SCRIPT_DIR/scripts/requirements.txt"

if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m ensurepip --upgrade >/dev/null 2>&1 || true
"$VENV_DIR/bin/python" -m pip install --upgrade pip
if ! "$VENV_DIR/bin/python" -m pip install -r "$REQ_FILE"; then
  echo "Could not read requirements file, using fallback dependency list..."
  echo "If this repeats, allow Terminal access to Desktop in macOS Privacy settings."
  "$VENV_DIR/bin/python" -m pip install \
    playwright \
    beautifulsoup4 \
    pandas \
    openpyxl \
    lxml \
    pyinstaller
fi
"$VENV_DIR/bin/python" -m playwright install chromium

exec "$VENV_DIR/bin/python" "$SCRIPT_DIR/scripts/launcher_gui.py"
