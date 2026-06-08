#!/usr/bin/env sh
# Serve the Vite SPA on Railway's PORT (required for health checks and routing).
set -e

cd "$(dirname "$0")/.."
listen_port="${PORT:-4173}"

exec pnpm exec serve dist -s -l "$listen_port" -c serve.json
