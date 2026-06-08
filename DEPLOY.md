# Fallen Sparrow: Production Deploy (Railway + Vercel)

Backend on **Railway**, frontend on **Vercel**. Custom domain: **FallenSparrowOS.com**. See **`docs/DOMAIN_SETUP.md`** for GoDaddy DNS and go-live. GitHub → Railway: **`docs/RAILWAY_GITHUB_DEPLOY.md`**. Bootstrap: `bash scripts/railway-github-bootstrap.sh`.

Quick connect:

```bash
# Add RAILWAY_TOKEN + VERCEL_TOKEN to .env, then:
bash scripts/connect-domain.sh
```

## Prerequisites

- GitHub repo connected to Railway
- Railway CLI optional (`pnpm deploy` runs `railway up`)
- Netlify account (or use [Netlify Drop](https://app.netlify.com/drop))
- Local `.env` values for secrets you will copy into Railway

### One-command deploy (CLI tokens)

If `railway login` is not available in CI, use account tokens:

1. Create `RAILWAY_TOKEN` at [railway.com/account/tokens](https://railway.com/account/tokens)
2. Optional: `VERCEL_TOKEN` or `NETLIFY_AUTH_TOKEN` for the frontend
3. From repo root: `bash scripts/deploy-production.sh`

### Emergency demo tunnel (dev only)

While production is pending auth, a single public URL can be exposed via Cloudflare quick tunnel to local Vite (Trevor's machine must stay on):

```bash
pnpm dev   # or node scripts/dev-local.mjs
npx cloudflared tunnel --url http://localhost:5173
```

`web/vite.config.ts` allows `.trycloudflare.com` hosts for this path.

## 1. Local verify (before deploy)

From the monorepo root:

```bash
npx --yes pnpm@9.15.0 install
pnpm typecheck
pnpm build
```

`pnpm build` runs shared, server, and web. Railway only builds shared + server (see `railway.toml`).

## 2. Deploy backend (Railway)

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select this repo. Railway reads `railway.toml` and `nixpacks.toml` at the root.
3. **Add plugin** → **PostgreSQL**. Railway injects `DATABASE_URL`.
4. Set environment variables (Railway service → **Variables**):

| Variable | Value |
|----------|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | from local `.env` (`openssl rand -hex 32`) |
| `ANTHROPIC_API_KEY` | from `.env` |
| `RESEND_API_KEY` | from `.env` |
| `QBO_CLIENT_ID` | from `.env` |
| `QBO_CLIENT_SECRET` | rotated secret |
| `QBO_ENVIRONMENT` | `sandbox` |
| `APP_BASE_URL` | `https://api.fallensparrowos.com` |
| `WEB_APP_URL` | `https://fallensparrowos.com` |
| `WEB_APP_ALLOWED_ORIGINS` | `https://www.fallensparrowos.com` |
| `DATABASE_URL` | auto from Postgres plugin |

Optional for full features: `RESEND_INBOUND_WEBHOOK_SECRET`, `SENTRY_DSN`, Twilio, R2, `BRIEFING_RECIPIENT_EMAIL`.

5. Deploy and watch build logs. Build order: `pnpm install` → `@fallen-sparrow/shared` build → `@fallen-sparrow/server` build.
6. Health check: open `https://<your-service>.up.railway.app/health`  
   Expected: `{"status":"ok","timestamp":"...","environment":"production"}`
7. **Migrations** (Railway shell on the API service):

```bash
pnpm db:migrate
```

Optional seed (dev/demo only): `pnpm db:seed`

## 3. Deploy frontend (Vercel)

`web/vercel.json` proxies `/api/*` to `https://api.fallensparrowos.com`, so build with empty API base:

```bash
cd web
VITE_API_BASE_URL= pnpm build
vercel deploy --prod
```

Add domains in Vercel: `fallensparrowos.com`, `www.fallensparrowos.com`. See `docs/DOMAIN_SETUP.md` for GoDaddy DNS.

## 4. Phone smoke test (before demo)

1. Open the Netlify URL on your phone
2. Log in as owner (seed: `owner@fallensparrow.local` / `ChangeMe123!` if seeded)
3. Dashboard loads with data
4. JARVIS: ask for a May recap
5. Settings → **Share for demo** shows the Netlify URL
6. Copy dashboard link and open `/sop-checklist` on the phone
7. iOS: Share → Add to Home Screen for the staff PWA

## Production URLs

```
App:           https://fallensparrowos.com
Staff PWA:     https://fallensparrowos.com/sop-checklist
Backend API:   https://api.fallensparrowos.com
Health:        https://api.fallensparrowos.com/health
```

## Config files in this repo

| File | Purpose |
|------|---------|
| `railway.toml` | Build/start commands, health check path `/health` |
| `nixpacks.toml` | Node 22 + pnpm, monorepo build phases |
| `.railwayignore` | Exclude web dist and local env from deploy context |
| Root `package.json` | `"deploy": "railway up"`, `"start"` runs server |

## API health endpoints

- `GET /health` — Railway health check (root)
- `GET /api/health` — same JSON shape, under API prefix

## Troubleshooting

- **Build fails on Railway:** confirm root directory is the monorepo root (not `server/`).
- **502 / health fails:** check `PORT` is set by Railway (default 3000 in code if unset; Railway usually sets `PORT`).
- **Frontend cannot reach API:** set `VITE_API_BASE_URL` at web build time and `WEB_APP_URL` on Railway to the Netlify origin.
- **Empty dashboard:** run `pnpm db:migrate` and import CSV or seed data.
