#!/usr/bin/env bash
# Railway monorepo build: picks server vs web from RAILWAY_SERVICE_NAME.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pnpm --filter @fallen-sparrow/shared build

service_name="${RAILWAY_SERVICE_NAME:-}"
service_name_lower="$(printf '%s' "$service_name" | tr '[:upper:]' '[:lower:]')"

if [[ "$service_name_lower" == *web* ]]; then
  echo "Railway build: @fallen-sparrow/web (service=${service_name:-unknown})"
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://api.fallensparrowos.com}" \
    pnpm --filter @fallen-sparrow/web build
else
  echo "Railway build: @fallen-sparrow/server (service=${service_name:-unknown})"
  pnpm --filter @fallen-sparrow/server build
fi
