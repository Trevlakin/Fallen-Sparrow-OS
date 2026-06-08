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

database_url_hint() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "unset"
    return
  fi
  if [[ "${DATABASE_URL}" == *'${{'* ]]; then
    echo "literal Railway template (use Variables → Add Reference → Postgres DATABASE_URL)"
    return
  fi
  if [[ "${DATABASE_URL}" == postgres://* || "${DATABASE_URL}" == postgresql://* ]]; then
    echo "set (postgres URL)"
    return
  fi
  echo "set but not a postgres URL (check Railway reference)"
}

run_db_setup() {
  set +e

  echo "Railway boot: DATABASE_URL is $(database_url_hint)"
  if [[ -n "${DATABASE_URL:-}" && "${DATABASE_URL}" == *'${{'* ]]; then
    echo "Railway boot: FATAL unresolved DATABASE_URL template. Fix in Railway dashboard, then redeploy."
    echo "Railway boot: See scripts/railway-fix-db.sh or docs/RAILWAY_ENV_VARS.md"
    return 1
  fi

  local migrate_ok=0
  local attempt
  for attempt in $(seq 1 20); do
    echo "Railway boot: running database migrations (attempt ${attempt}/20)..."
    run_with_timeout 120 pnpm db:migrate
    local migrate_status=$?
    if [[ $migrate_status -eq 0 ]]; then
      echo "Railway boot: migrations complete"
      migrate_ok=1
      break
    fi
    echo "Railway boot: migrations failed (exit ${migrate_status}); retrying in 5s..."
    sleep 5
  done

  if [[ $migrate_ok -ne 1 ]]; then
    echo "Railway boot: WARNING migrations did not succeed after 20 attempts (check Postgres service and DATABASE_URL reference)"
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
