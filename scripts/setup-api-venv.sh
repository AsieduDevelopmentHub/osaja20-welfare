#!/usr/bin/env bash
# Creates a local virtual environment for the API (not global).
set -euo pipefail
cd "$(dirname "$0")/../apps/api"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "Created .venv in apps/api"
fi

# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "API venv ready. Activate with:"
echo "  cd apps/api && source .venv/bin/activate"
