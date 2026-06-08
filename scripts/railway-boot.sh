#!/usr/bin/env bash
# Railway API boot: migrate + optional seed, then start API.
# DB setup runs in the background so PORT binds immediately (Railway health checks).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/server/dist/index.js" ]]; then
  echo "Railway boot: FATAL server/dist/index.js missing (build step failed?)"
  exit 1
fi

run_with_timeout() {
  local seconds="$1"
  shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$seconds" "$@"
  else
    "$@"
  fi
}

run_db_setup() {
  set +e

  echo "Railway boot: running database migrations..."
  run_with_timeout 120 pnpm db:migrate
  local migrate_status=$?
  if [[ $migrate_status -eq 0 ]]; then
    echo "Railway boot: migrations complete"
  else
    echo "Railway boot: WARNING migrations failed (exit ${migrate_status}; check DATABASE_URL=${DATABASE_URL:+set}${DATABASE_URL:-unset} and Postgres service)"
  fi

  if [[ -n "${OWNER_SEED_EMAIL:-}" && -n "${OWNER_SEED_PASSWORD:-}" ]]; then
    echo "Railway boot: seeding owner account (idempotent)..."
    run_with_timeout 90 pnpm db:seed
    local seed_status=$?
    if [[ $seed_status -eq 0 ]]; then
      echo "Railway boot: seed complete"
    else
      echo "Railway boot: WARNING seed failed (exit ${seed_status})"
    fi
  else
    echo "Railway boot: skipping seed (set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD to create owner on first boot)"
  fi
}

run_db_setup &

echo "Railway boot: starting API (migrate/seed running in background)"
exec pnpm --filter @fallen-sparrow/server start
