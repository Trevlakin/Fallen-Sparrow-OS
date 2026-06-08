#!/usr/bin/env bash
# Validates the repo is ready for Railway "Deploy from GitHub" and prints a dashboard checklist.
# Does not deploy, commit, or print secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DOMAIN="fallensparrowos.com"
API_HOST="api.${DOMAIN}"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ok() { echo -e "${GREEN}OK${NC}  $*"; }
warn() { echo -e "${YELLOW}WARN${NC}  $*"; }
fail() { echo -e "${RED}FAIL${NC} $*"; }

echo "Fallen Sparrow: Railway + GitHub bootstrap"
echo "==========================================="
echo ""

# Git
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ok "Git repository initialized"
else
  fail "Not a git repository. Run: git init"
  exit 1
fi

if git rev-parse HEAD >/dev/null 2>&1; then
  ok "At least one commit exists ($(git rev-parse --short HEAD))"
else
  fail "No commits yet. Railway needs a pushed branch (usually main)."
  echo "      Stage and commit, then push to GitHub (see docs/RAILWAY_GITHUB_DEPLOY.md)."
fi

BRANCH="$(git branch --show-current 2>/dev/null || echo unknown)"
echo "      Branch: ${BRANCH}"

if git remote get-url origin >/dev/null 2>&1; then
  ok "Git remote 'origin': $(git remote get-url origin)"
else
  warn "No GitHub remote 'origin'. Create a repo and: git remote add origin <url>"
fi

if [[ -f railway.toml && -f nixpacks.toml ]]; then
  ok "railway.toml + nixpacks.toml present (monorepo root deploy)"
else
  fail "Missing railway.toml or nixpacks.toml at repo root"
fi

if grep -q '^RAILWAY_TOKEN=' .env 2>/dev/null; then
  ok "RAILWAY_TOKEN key present in .env (CLI fallback available)"
else
  warn "RAILWAY_TOKEN not in .env: use Railway dashboard GitHub deploy (no CLI token required)"
fi

if grep -q '^VERCEL_TOKEN=' .env 2>/dev/null; then
  ok "VERCEL_TOKEN key present in .env"
else
  warn "VERCEL_TOKEN not in .env: set up Vercel via dashboard import (web/)"
fi

echo ""
if [[ "${1:-}" == "--verify-build" ]]; then
  echo "Running install, typecheck, build..."
  npx --yes pnpm@9.15.0 install --frozen-lockfile
  npx --yes pnpm@9.15.0 run typecheck
  npx --yes pnpm@9.15.0 run build
  ok "typecheck + build passed"
  echo ""
fi

cat << EOF
Railway dashboard checklist (GitHub deploy)
-------------------------------------------
1. Push this repo to GitHub (private recommended).
2. https://railway.app → New Project → Deploy from GitHub.
3. Authorize Railway GitHub app if prompted; select the repo.
4. Root directory: repository root (not server/ or web/).
5. Confirm build uses railway.toml / nixpacks.toml.
6. Add plugin → PostgreSQL (links DATABASE_URL to the API service).
7. Service → Variables (production):

   Required at boot (Zod in server/src/config/env.ts):
   - NODE_ENV=production
   - DATABASE_URL          (from Postgres plugin)
   - JWT_SECRET            (openssl rand -hex 32, min 32 chars)
   - APP_BASE_URL=https://${API_HOST}
   - WEB_APP_URL=https://${DOMAIN}

   Production URLs / CORS / QuickBooks:
   - WEB_APP_ALLOWED_ORIGINS=https://www.${DOMAIN}
   - QBO_REDIRECT_URI=https://${API_HOST}/api/quickbooks/callback

   Copy from local .env as needed:
   - ANTHROPIC_API_KEY, ANTHROPIC_MODEL (default claude-sonnet-4-6)
   - RESEND_API_KEY, RESEND_FROM_EMAIL, PORTER_INBOUND_EMAIL
   - RESEND_INBOUND_WEBHOOK_SECRET
   - TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
   - R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL
   - QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_ENVIRONMENT, QBO_REALM_ID
   - BRIEFING_RECIPIENT_EMAIL, BRIEFING_SEND_HOUR, WEEKLY_REPORT_DAY, WEEKLY_REPORT_HOUR
   - SENTRY_DSN (optional)
   - DEFAULT_TIMEZONE=America/New_York

   Do not set PORT manually; Railway injects it.

8. Deploy → wait for build → open generated *.up.railway.app/health
9. Service → Settings → Networking → Custom Domain → ${API_HOST}
10. Post-deploy shell on API service:
    pnpm db:migrate
    pnpm db:seed   (demo only; skip for real prod if preferred)

Vercel (frontend): import same repo, root directory web/
DNS: docs/DOMAIN_SETUP.md

CLI fallback (after link): export RAILWAY_TOKEN=... && bash scripts/deploy-production.sh
Full guide: docs/RAILWAY_GITHUB_DEPLOY.md
EOF
