#!/usr/bin/env bash
# Link Postgres DATABASE_URL on the API service, set seed vars, redeploy, run migrations.
# Requires RAILWAY_TOKEN: https://railway.com/account/tokens (add to .env as RAILWAY_TOKEN=...)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RAILWAY="${RAILWAY:-npx --yes @railway/cli@4.5.4}"
API_URL="${API_URL:-https://api.fallensparrowos.com}"
RAILWAY_PROJECT="${RAILWAY_PROJECT:-Fallen Sparrow OS}"
RAILWAY_API_SERVICE="${RAILWAY_API_SERVICE:-@fallen-sparrow/server}"
RAILWAY_WEB_SERVICE="${RAILWAY_WEB_SERVICE:-@fallen-sparrow/web}"

echo "Fallen Sparrow: Railway database fix"
echo "===================================="

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  cat << 'MANUAL'

RAILWAY_TOKEN is not set. Do one of the following:

A) CLI (recommended after one-time token):
   1. Create a token: https://railway.com/account/tokens
   2. Add to .env: RAILWAY_TOKEN=...
   3. Re-run: bash scripts/railway-fix-db.sh

B) Railway dashboard (no token): see docs/RAILWAY_TROUBLESHOOTING.md
   section "Login 503 / ECONNREFUSED (DATABASE_URL on wrong service)".

MANUAL
  exit 1
fi

export RAILWAY_TOKEN

if ! $RAILWAY whoami >/dev/null 2>&1; then
  echo "ERROR: RAILWAY_TOKEN is set but 'railway whoami' failed."
  echo "Create a fresh token at https://railway.com/account/tokens and update .env."
  exit 1
fi

echo "==> Linking project ${RAILWAY_PROJECT} → service ${RAILWAY_API_SERVICE}"
$RAILWAY link -p "$RAILWAY_PROJECT" -s "$RAILWAY_API_SERVICE"

echo "==> Detecting Postgres service name for DATABASE_URL reference"
POSTGRES_REF="${RAILWAY_POSTGRES_REF:-}"
if [[ -z "$POSTGRES_REF" ]]; then
  for candidate in Postgres PostgreSQL postgres postgresql; do
    if $RAILWAY variables --service "$candidate" --json 2>/dev/null | grep -q DATABASE_URL; then
      POSTGRES_REF="${candidate}"
      break
    fi
  done
fi
if [[ -z "$POSTGRES_REF" ]]; then
  POSTGRES_REF="Postgres"
  echo "WARN: Could not auto-detect Postgres service; defaulting reference name to Postgres."
  echo "      If deploy still fails, set RAILWAY_POSTGRES_REF=<exact service name> and re-run."
else
  echo "Using Postgres service name: ${POSTGRES_REF}"
fi

DB_REF="\${{${POSTGRES_REF}.DATABASE_URL}}"

echo "==> Setting API service variables (DATABASE_URL reference + owner seed)"
$RAILWAY variables --service "$RAILWAY_API_SERVICE" \
  --set "NODE_ENV=production" \
  --set "DATABASE_URL=${DB_REF}" \
  --set "OWNER_SEED_EMAIL=${OWNER_SEED_EMAIL:-admin@fallensparrowos.com}" \
  --set "OWNER_SEED_PASSWORD=${OWNER_SEED_PASSWORD:-ChangeMe123!}" \
  --set "FS_ROLE=server"

echo "==> Setting web service FS_ROLE=web"
$RAILWAY variables --service "$RAILWAY_WEB_SERVICE" --set "FS_ROLE=web" || true

echo "==> Redeploying API service"
$RAILWAY redeploy --service "$RAILWAY_API_SERVICE" --yes

echo "==> Waiting for deploy (60s)..."
sleep 60

echo "==> Running migrations via Railway run (backup if boot migrate is slow)"
$RAILWAY run --service "$RAILWAY_API_SERVICE" pnpm db:migrate
$RAILWAY run --service "$RAILWAY_API_SERVICE" pnpm db:seed

echo "==> Verify production"
echo "Health: curl -sS ${API_URL}/health"
curl -sS "${API_URL}/health" || true
echo ""
echo "Ready: curl -sS ${API_URL}/health/ready"
curl -sS "${API_URL}/health/ready" || true
echo ""
echo "Login:"
curl -sS -X POST "${API_URL}/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${OWNER_SEED_EMAIL:-admin@fallensparrowos.com}\",\"password\":\"${OWNER_SEED_PASSWORD:-ChangeMe123!}\"}" \
  -w "\nHTTP:%{http_code}\n" || true

echo ""
echo "Done. Full env list: docs/RAILWAY_ENV_VARS.md"
