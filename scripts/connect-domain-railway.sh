#!/usr/bin/env bash
# Railway-only deploy for FallenSparrowOS.com (no Vercel).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN="fallensparrowos.com"
API_HOST="api.${DOMAIN}"
APP_URL="https://${DOMAIN}"
API_URL="https://${API_HOST}"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

RAILWAY="${RAILWAY:-npx --yes @railway/cli@4.5.4}"

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  echo "Missing RAILWAY_TOKEN. Create at https://railway.com/account/tokens"
  echo "Add to .env then re-run: bash scripts/connect-domain-railway.sh"
  exit 1
fi

export RAILWAY_TOKEN

echo "==> Build"
npx --yes pnpm@9.15.0 install --frozen-lockfile
npx --yes pnpm@9.15.0 run typecheck
npx --yes pnpm@9.15.0 run build

echo "==> Railway deploy"
$RAILWAY link 2>/dev/null || true
$RAILWAY up --detach

echo "==> Server env vars"
POSTGRES_REF="${RAILWAY_POSTGRES_REF:-Postgres}"
$RAILWAY variables set \
  "NODE_ENV=production" \
  "FS_ROLE=server" \
  "DATABASE_URL=\${{${POSTGRES_REF}.DATABASE_URL}}" \
  "OWNER_SEED_EMAIL=${OWNER_SEED_EMAIL:-admin@fallensparrowos.com}" \
  "OWNER_SEED_PASSWORD=${OWNER_SEED_PASSWORD:-ChangeMe123!}" \
  "APP_BASE_URL=${API_URL}" \
  "WEB_APP_URL=${APP_URL}" \
  "WEB_APP_ALLOWED_ORIGINS=https://www.${DOMAIN}" \
  "QBO_REDIRECT_URI=${API_URL}/api/quickbooks/callback"

echo "==> Migrations"
$RAILWAY run pnpm db:migrate

echo "==> Custom domains (copy CNAME targets from Railway if these fail)"
$RAILWAY domain "${API_HOST}" 2>/dev/null || echo "Add ${API_HOST} on server service → Networking"
$RAILWAY domain "${DOMAIN}" 2>/dev/null || echo "Add ${DOMAIN} on web service → Networking"

echo ""
echo "=============================================="
echo " GoDaddy DNS (Railway-only)"
echo "=============================================="
echo ""
echo "  1. server → Networking → api.fallensparrowos.com → copy CNAME"
echo "  2. web    → Networking → fallensparrowos.com     → copy CNAME"
echo ""
echo "  Add in GoDaddy DNS:"
echo "    CNAME  api  →  <server CNAME from Railway>"
echo "    CNAME  @ or www  →  <web CNAME from Railway>"
echo ""
echo "  App:   ${APP_URL}"
echo "  API:   ${API_URL}/health"
echo "  Staff: ${APP_URL}/sop-checklist"
echo ""
echo "Full guide: docs/RAILWAY_ONLY.md"
echo "=============================================="
