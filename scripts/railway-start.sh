#!/usr/bin/env bash
# Railway monorepo start: FS_ROLE env var decides server vs web.
# Set FS_ROLE=web on the web service, FS_ROLE=server (or leave unset) on the API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

role="${FS_ROLE:-server}"
echo "Railway start: role=${role}, PORT=${PORT:-unset}"

if [[ "$role" == "web" ]]; then
  echo "Starting SPA (serve)"
  web_dir="$ROOT/web"
  cd "$web_dir"
  exec npx serve dist -s -l "${PORT:-4173}" -c "${web_dir}/serve.json"
fi

echo "Starting API (Express)"
exec pnpm --filter @fallen-sparrow/server start
