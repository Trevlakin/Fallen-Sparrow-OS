#!/usr/bin/env bash
# Railway API boot: migrate (and optional owner seed) before listening.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Railway boot: running database migrations..."
pnpm db:migrate

if [[ -n "${OWNER_SEED_EMAIL:-}" && -n "${OWNER_SEED_PASSWORD:-}" ]]; then
  echo "Railway boot: seeding owner account (idempotent)..."
  pnpm db:seed
else
  echo "Railway boot: skipping seed (set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD to create owner on first boot)"
fi

echo "Railway boot: starting API"
exec pnpm --filter @fallen-sparrow/server start
