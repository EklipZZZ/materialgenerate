#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

echo "Loading environment variables..."
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

echo "Installing dependencies..."
pnpm install --frozen-lockfile

echo "Installing Python dependencies..."
pip3 install python-docx markdown beautifulsoup4 --quiet || true

echo "Building the project..."
pnpm next build

echo "Build completed successfully!"
