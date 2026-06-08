#!/usr/bin/env bash
# Railway monorepo build: FS_ROLE env var decides server vs web.
# Set FS_ROLE=web on the web service, FS_ROLE=server (or leave unset) on the API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @fallen-sparrow/shared build

role="${FS_ROLE:-server}"
svc="${RAILWAY_SERVICE_NAME:-unknown}"

echo "Railway build: role=${role}, RAILWAY_SERVICE_NAME=${svc}"

if [[ "$role" == "web" ]]; then
  echo "Building @fallen-sparrow/web (SPA)"
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.fallensparrowos.com}" \
    pnpm --filter @fallen-sparrow/web build
else
  echo "Building @fallen-sparrow/server (API)"
  pnpm --filter @fallen-sparrow/server build
fi
