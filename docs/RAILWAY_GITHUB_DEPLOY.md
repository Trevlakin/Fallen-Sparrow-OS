# Railway production deploy via GitHub

This guide is for **Legion / Trevor**: connect the Fallen Sparrow monorepo to Railway using **Deploy from GitHub** (no `RAILWAY_TOKEN` required for the first deploy). Custom domains and Vercel are in **`docs/DOMAIN_SETUP.md`**.

## One-page checklist (start here)

**Pushing to GitHub alone does not create a Railway project.** If the dashboard is empty, follow **[`docs/RAILWAY_TROUBLESHOOTING.md`](./RAILWAY_TROUBLESHOOTING.md)** first.

| Step | Action | Done |
|------|--------|------|
| 1 | Code on GitHub: [Trevlakin/Fallen-Sparrow-OS](https://github.com/Trevlakin/Fallen-Sparrow-OS) on `main` | ☐ |
| 2 | Install [Railway GitHub App](https://railway.app/account/connections); grant access to this repo | ☐ |
| 3 | Railway → **New Project** → **Deploy from GitHub** → select repo; root directory **`.`** | ☐ |
| 4 | **+ New** → **Database** → **PostgreSQL**; confirm `DATABASE_URL` on API service | ☐ |
| 5 | Set required env vars (Step 4 below); redeploy | ☐ |
| 6 | Shell: `pnpm db:migrate` | ☐ |
| 7 | Custom domain + Vercel (Steps 6–7 below) when ready | ☐ |

**Stuck?** [`docs/RAILWAY_TROUBLESHOOTING.md`](./RAILWAY_TROUBLESHOOTING.md) (empty dashboard, repo not in picker, wrong account).

---

## What Railway builds

| File | Role |
|------|------|
| `railway.toml` | Build command, start command, `/health` healthcheck |
| `nixpacks.toml` | Node 22 + pnpm; builds `shared` then `server` |
| Repo root | **Must** be the Railway service root (not `server/` or `web/`) |

The API listens on Railway's `PORT`. Frontend deploys separately on **Vercel** with root directory **`web`**.

---

## Prerequisites

1. **GitHub repository** with at least one commit on `main` (or your default branch).
2. **Railway account** linked to GitHub ([railway.app](https://railway.app)) with access to **Trevlakin/Fallen-Sparrow-OS**.
3. Secrets ready to paste into Railway Variables (copy names from `.env.example`; values from local `.env`, never commit `.env`).

### Local verify (recommended)

```bash
bash scripts/railway-github-bootstrap.sh --verify-build
```

Or manually from repo root:

```bash
npx --yes pnpm@9.15.0 install --frozen-lockfile
pnpm typecheck
pnpm build
```

---

## Step 1: Put code on GitHub

**Current automation note:** This workspace may have **no commits** and **no `origin` remote** yet. Complete these steps locally before Railway can see the repo.

### Option A: GitHub website

1. **Live repo:** [github.com/Trevlakin/Fallen-Sparrow-OS](https://github.com/Trevlakin/Fallen-Sparrow-OS) (`main`, commit on `origin`).

For a fresh clone or second machine:

```bash
git clone https://github.com/Trevlakin/Fallen-Sparrow-OS.git
cd Fallen-Sparrow-OS
```

### Option B: GitHub CLI (`gh`)

Install: [cli.github.com](https://cli.github.com) (the `npx gh` package is **not** the official CLI).

```bash
gh auth login
gh repo create fallen-sparrow-os --private --source=. --remote=origin --push
```

If `gh` is missing or auth fails, use Option A.

---

## Step 2: Railway: New project from GitHub

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. If asked, **install/configure the Railway GitHub App** and grant access to the repo.
3. Select the Fallen Sparrow repository.
4. **Root directory:** leave as **repository root** (`.`).
5. Railway should detect `railway.toml` / Nixpacks. First deploy may start automatically.

---

## Step 3: PostgreSQL

1. In the project → **+ New** → **Database** → **PostgreSQL**.
2. Open the Postgres service → **Variables** or **Connect** → copy `DATABASE_URL`.
3. On the **API/web service** (Node app), add variable reference or paste `DATABASE_URL` so the API service can reach the database (Railway often wires this when both are in the same project; confirm the API service has `DATABASE_URL`).

---

## Step 4: Environment variables (API service)

Railway → your **API service** → **Variables**. Production targets use **FallenSparrowOS.com**.

### Required for server boot

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Postgres plugin |
| `JWT_SECRET` | `openssl rand -hex 32` (minimum 32 characters) |
| `APP_BASE_URL` | `https://api.fallensparrowos.com` |
| `WEB_APP_URL` | `https://fallensparrowos.com` |

### Strongly recommended for prod

| Variable | Production value |
|----------|------------------|
| `WEB_APP_ALLOWED_ORIGINS` | `https://www.fallensparrowos.com` |
| `QBO_REDIRECT_URI` | `https://api.fallensparrowos.com/api/quickbooks/callback` |
| `DEFAULT_TIMEZONE` | `America/New_York` |
| `ANTHROPIC_API_KEY` | Your key (needed for Jarvis, briefing, receipts) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |

### Feature integrations (copy from `.env` when ready)

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email, briefings |
| `PORTER_INBOUND_EMAIL`, `RESEND_INBOUND_WEBHOOK_SECRET` | Porter CSV via Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | SMS nudges |
| `R2_*` | Receipt/file storage |
| `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_ENVIRONMENT`, `QBO_REALM_ID` | QuickBooks |
| `BRIEFING_RECIPIENT_EMAIL`, `BRIEFING_SEND_HOUR`, `WEEKLY_REPORT_*` | Scheduled jobs |
| `SENTRY_DSN` | Error monitoring (optional) |

**Do not** set `PORT`; Railway sets it.

Redeploy after changing variables if the service does not restart automatically.

---

## Step 5: Migrations and seed

After a successful deploy:

1. Railway → API service → **Settings** → open **Shell** (or use CLI: `railway run` after linking).
2. Run:

```bash
pnpm db:migrate
```

3. Optional demo data:

```bash
pnpm db:seed
```

Skip seed on real production if you do not want demo users.

---

## Step 6: Custom API domain

1. API service → **Settings** → **Networking** → **Custom Domain**.
2. Add `api.fallensparrowos.com`.
3. Add the **CNAME** Railway shows at GoDaddy (see **`docs/DOMAIN_SETUP.md`**).
4. Confirm `APP_BASE_URL` and `QBO_REDIRECT_URI` match the custom domain.

Health check:

```bash
curl -s https://api.fallensparrowos.com/health
```

---

## Step 7: Vercel frontend (same GitHub repo)

1. [vercel.com](https://vercel.com) → **Add New Project** → import the **same** GitHub repo.
2. **Root Directory:** `web`.
3. Add domains `fallensparrowos.com` and `www.fallensparrowos.com` (DNS in **`docs/DOMAIN_SETUP.md`**).
4. `web/vercel.json` proxies `/api` to the Railway API host.

---

## GitHub deploy vs CLI

| Path | When to use |
|------|-------------|
| **GitHub → Railway** | Default; auto-deploy on push; no local token |
| **`RAILWAY_TOKEN` + scripts** | `bash scripts/deploy-production.sh` or `bash scripts/connect-domain.sh` after [creating a token](https://railway.com/account/tokens) |

Bootstrap checklist (no secrets printed):

```bash
bash scripts/railway-github-bootstrap.sh
```

---

## Troubleshooting

**No project in Railway dashboard?** See **[`docs/RAILWAY_TROUBLESHOOTING.md`](./RAILWAY_TROUBLESHOOTING.md)** (GitHub App, Deploy from GitHub, wrong workspace).

| Symptom | What to check |
|---------|----------------|
| Empty dashboard after `git push` | You must **Deploy from GitHub** once; push does not auto-create a project |
| Build fails on Railway | Build logs; run `bash scripts/railway-github-bootstrap.sh --verify-build` locally |
| Service crashes on start | Deploy logs; missing `JWT_SECRET`, `DATABASE_URL`, or invalid URLs in `APP_BASE_URL` / `WEB_APP_URL` |
| `/health` 502 | Deploy finished? Postgres reachable? `DATABASE_URL` on API service? |
| CORS errors from browser | `WEB_APP_URL` and `WEB_APP_ALLOWED_ORIGINS` on Railway |
| Migrations not applied | Run `pnpm db:migrate` in Railway shell |

---

## Related docs

- **`docs/RAILWAY_TROUBLESHOOTING.md`**: Empty dashboard, GitHub App, repo access, wrong account
- **`docs/DOMAIN_SETUP.md`**: GoDaddy DNS, Vercel + Railway domains, smoke tests
- **`docs/GODADDY_DNS.md`**: GoDaddy copy-paste DNS after Railway/Vercel exist
- **`DEPLOY.md`**: Short deploy overview
- **`scripts/connect-domain.sh`**: Token-based full stack + domain hints
