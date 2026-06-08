#!/usr/bin/env bash
# Railway API boot: migrate (and optional owner seed) before listening.
# Migrate/seed failures are logged but do not block the API from starting.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Railway boot: running database migrations..."
if pnpm db:migrate; then
  echo "Railway boot: migrations complete"
else
  echo "Railway boot: WARNING migrations failed (check DATABASE_URL and Postgres service)"
fi

if [[ -n "${OWNER_SEED_EMAIL:-}" && -n "${OWNER_SEED_PASSWORD:-}" ]]; then
  echo "Railway boot: seeding owner account (idempotent)..."
  if pnpm db:seed; then
    echo "Railway boot: seed complete"
  else
    echo "Railway boot: WARNING seed failed"
  fi
else
  echo "Railway boot: skipping seed (set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD to create owner on first boot)"
fi

echo "Railway boot: starting API"
exec pnpm --filter @fallen-sparrow/server start
