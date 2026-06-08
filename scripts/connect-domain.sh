#!/usr/bin/env bash
# Deploy Fallen Sparrow to Railway + Vercel and wire FallenSparrowOS.com.
# Requires RAILWAY_TOKEN and VERCEL_TOKEN in env or .env (sourced below).
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
VERCEL="${VERCEL:-npx --yes vercel@41.7.0}"

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  echo "Missing RAILWAY_TOKEN."
  echo "Create at https://railway.com/account/tokens then add to .env or export."
  echo "Full guide: docs/DOMAIN_SETUP.md"
  exit 1
fi

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Missing VERCEL_TOKEN."
  echo "Create at https://vercel.com/account/tokens then add to .env or export."
  echo "Full guide: docs/DOMAIN_SETUP.md"
  exit 1
fi

export RAILWAY_TOKEN VERCEL_TOKEN

echo "==> Build"
npx --yes pnpm@9.15.0 install --frozen-lockfile
npx --yes pnpm@9.15.0 run typecheck
npx --yes pnpm@9.15.0 run build

echo "==> Railway deploy"
$RAILWAY link 2>/dev/null || $RAILWAY init --name fallen-sparrow 2>/dev/null || true
$RAILWAY up --detach

echo "==> Railway production env"
$RAILWAY variables set \
  "NODE_ENV=production" \
  "APP_BASE_URL=${API_URL}" \
  "WEB_APP_URL=${APP_URL}" \
  "WEB_APP_ALLOWED_ORIGINS=https://www.${DOMAIN}" \
  "QBO_REDIRECT_URI=${API_URL}/api/quickbooks/callback"

echo "==> Migrations"
$RAILWAY run pnpm db:migrate
$RAILWAY run pnpm db:seed || true

echo "==> Vercel deploy (web/)"
cd web
# Empty VITE_API_BASE_URL: same-origin /api via vercel.json proxy
VITE_API_BASE_URL="" npx --yes pnpm@9.15.0 build
$VERCEL link --yes --token "$VERCEL_TOKEN" 2>/dev/null || true
$VERCEL deploy --prod --yes --token "$VERCEL_TOKEN"
cd ..

echo "==> Register custom domains (may require DNS first)"
$RAILWAY domain "${API_HOST}" 2>/dev/null || echo "Add ${API_HOST} in Railway dashboard → Networking"
$VERCEL domains add "${DOMAIN}" --token "$VERCEL_TOKEN" 2>/dev/null || true
$VERCEL domains add "www.${DOMAIN}" --token "$VERCEL_TOKEN" 2>/dev/null || true

echo ""
echo "=============================================="
echo " GoDaddy DNS for FallenSparrowOS.com"
echo "=============================================="
echo ""
echo "  Type A     Name @     Value 76.76.21.21"
echo "  Type CNAME Name www   Value cname.vercel-dns.com"
echo "  Type CNAME Name api   Value <Railway CNAME from dashboard>"
echo ""
echo "  App:    ${APP_URL}"
echo "  API:    ${API_URL}/health"
echo "  Staff:  ${APP_URL}/sop-checklist"
echo ""
echo "Full steps: docs/DOMAIN_SETUP.md"
echo "=============================================="
