#!/usr/bin/env bash
# Railway monorepo start: picks server vs web from RAILWAY_SERVICE_NAME.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

service_name="${RAILWAY_SERVICE_NAME:-}"
service_name_lower="$(printf '%s' "$service_name" | tr '[:upper:]' '[:lower:]')"

if [[ "$service_name_lower" == *web* ]]; then
  echo "Railway start: @fallen-sparrow/web (service=${service_name:-unknown}, PORT=${PORT:-unset})"
  exec pnpm --filter @fallen-sparrow/web start
fi

echo "Railway start: @fallen-sparrow/server (service=${service_name:-unknown}, PORT=${PORT:-unset})"
exec pnpm --filter @fallen-sparrow/server start
