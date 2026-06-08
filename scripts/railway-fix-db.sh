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

echo "Fallen Sparrow: Railway database fix"
echo "===================================="

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  cat << 'MANUAL'

RAILWAY_TOKEN is not set. Do one of the following:

A) CLI (recommended after one-time token):
   1. Create a token: https://railway.com/account/tokens
   2. Add to .env: RAILWAY_TOKEN=...
   3. Re-run: bash scripts/railway-fix-db.sh

B) Railway dashboard (no token):
   1. Project → ensure a PostgreSQL plugin exists (+ New → Database → PostgreSQL).
   2. Open the API service (@fallen-sparrow/server or Node service with FS_ROLE=server).
   3. Variables → DATABASE_URL → use "Add Reference" (not plain text):
        Value: ${{Postgres.DATABASE_URL}}
      If that fails, open the Postgres service and note its exact name (e.g. PostgreSQL).
      Use: ${{<ExactServiceName>.DATABASE_URL}}
   4. Set OWNER_SEED_EMAIL and OWNER_SEED_PASSWORD (see docs/RAILWAY_ENV_VARS.md).
   5. Deployments → Redeploy latest.
   6. Verify:
        curl -sS https://api.fallensparrowos.com/health/ready
        curl -sS -X POST https://api.fallensparrowos.com/api/auth/login \\
          -H "Content-Type: application/json" \\
          -d '{"email":"admin@fallensparrowos.com","password":"ChangeMe123!"}'

MANUAL
  exit 1
fi

export RAILWAY_TOKEN

echo "==> Linking Railway project (select API/server service when prompted)"
$RAILWAY link || true

echo "==> Detecting Postgres service name for DATABASE_URL reference"
POSTGRES_REF="${RAILWAY_POSTGRES_REF:-}"
if [[ -z "$POSTGRES_REF" ]]; then
  for candidate in Postgres PostgreSQL postgres postgresql; do
    if $RAILWAY variables --service "$candidate" 2>/dev/null | grep -q DATABASE_URL; then
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
$RAILWAY variables set \
  "NODE_ENV=production" \
  "DATABASE_URL=${DB_REF}" \
  "OWNER_SEED_EMAIL=${OWNER_SEED_EMAIL:-admin@fallensparrowos.com}" \
  "OWNER_SEED_PASSWORD=${OWNER_SEED_PASSWORD:-ChangeMe123!}" \
  "FS_ROLE=server"

echo "==> Redeploying API service"
$RAILWAY redeploy --yes 2>/dev/null || $RAILWAY up --detach

echo "==> Running migrations via Railway run (backup if boot migrate is slow)"
$RAILWAY run pnpm db:migrate
$RAILWAY run pnpm db:seed

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
