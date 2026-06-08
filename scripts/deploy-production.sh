#!/usr/bin/env bash
# Fallen Sparrow production deploy (Railway API + Vercel/Netlify frontend).
# Requires: RAILWAY_TOKEN (https://railway.com/account/tokens)
# Optional: VERCEL_TOKEN or NETLIFY_AUTH_TOKEN for frontend.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RAILWAY="${RAILWAY:-npx --yes @railway/cli@4.5.4}"
VERCEL="${VERCEL:-npx --yes vercel@41.7.0}"
NETLIFY="${NETLIFY:-npx --yes netlify-cli@19.0.0}"

if [[ -z "${RAILWAY_TOKEN:-}" ]]; then
  echo "Missing RAILWAY_TOKEN. Create one at https://railway.com/account/tokens"
  echo "Then: export RAILWAY_TOKEN=... && bash scripts/deploy-production.sh"
  exit 1
fi

export RAILWAY_TOKEN

echo "==> Typecheck and build"
npx --yes pnpm@9.15.0 install --frozen-lockfile
npx --yes pnpm@9.15.0 run typecheck
npx --yes pnpm@9.15.0 run build

echo "==> Railway deploy (monorepo root)"
$RAILWAY link 2>/dev/null || $RAILWAY init --name fallen-sparrow 2>/dev/null || true
$RAILWAY up --detach

API_URL="$($RAILWAY domain 2>/dev/null | head -1 || true)"
if [[ -z "$API_URL" ]]; then
  echo "Set APP_BASE_URL in Railway dashboard after deploy, then re-run this script for frontend."
  exit 0
fi
[[ "$API_URL" != http* ]] && API_URL="https://${API_URL}"
echo "API URL: $API_URL"

echo "==> Migrations on Railway"
$RAILWAY run pnpm db:migrate
$RAILWAY run pnpm db:seed

if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  echo "==> Vercel deploy"
  export VERCEL_TOKEN
  cd web
  VITE_API_BASE_URL="$API_URL" npx --yes pnpm@9.15.0 build
  $VERCEL deploy --prod --yes --token "$VERCEL_TOKEN"
  FRONTEND_URL="$($VERCEL inspect --token "$VERCEL_TOKEN" 2>/dev/null | head -1 || echo "")"
  cd ..
elif [[ -n "${NETLIFY_AUTH_TOKEN:-}" ]]; then
  echo "==> Netlify deploy"
  VITE_API_BASE_URL="$API_URL" npx --yes pnpm@9.15.0 --filter @fallen-sparrow/web build
  $NETLIFY deploy --prod --dir=web/dist --auth "$NETLIFY_AUTH_TOKEN"
else
  echo "No VERCEL_TOKEN or NETLIFY_AUTH_TOKEN. Build frontend locally:"
  echo "  VITE_API_BASE_URL=$API_URL pnpm --filter @fallen-sparrow/web build"
  echo "  Then drag web/dist to https://app.netlify.com/drop"
  exit 0
fi

if [[ -n "${FRONTEND_URL:-}" ]]; then
  echo "==> Set WEB_APP_URL=$FRONTEND_URL on Railway"
  $RAILWAY variables set "WEB_APP_URL=$FRONTEND_URL" "APP_BASE_URL=$API_URL" "NODE_ENV=production"
fi

echo "Done. Health: ${API_URL}/health"
