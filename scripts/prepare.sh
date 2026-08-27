#!/usr/bin/env bash
set -euo pipefail
pnpm install --frozen-lockfile
python3 -m pip install -r requirements.txt --quiet
