#!/usr/bin/env bash
# Railway API boot: start API immediately; migrate/seed in background so health checks pass.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MIGRATE_TIMEOUT_SEC="${RAILWAY_MIGRATE_TIMEOUT_SEC:-90}"

run_db_setup() {
  echo "Railway boot: running database migrations (background)..."
  if timeout "${MIGRATE_TIMEOUT_SEC}" pnpm db:migrate; then
    echo "Railway boot: migrations complete"
  else
    echo "Railway boot: WARNING migrations failed or timed out (check DATABASE_URL and Postgres service)"
  fi

  if [[ -n "${OWNER_SEED_EMAIL:-}" && -n "${OWNER_SEED_PASSWORD:-}" ]]; then
    echo "Railway boot: seeding owner account (idempotent)..."
    if timeout "${MIGRATE_TIMEOUT_SEC}" pnpm db:seed; then
      echo "Railway boot: seed complete"
    else
      echo "Railway boot: WARNING seed failed or timed out"
    fi
  else
    echo "Railway boot: skipping seed (set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD to create owner on first boot)"
  fi
}

run_db_setup &

echo "Railway boot: starting API"
exec pnpm --filter @fallen-sparrow/server start
