# FallenSparrowOS.com — Domain + Production Setup

Connect **FallenSparrowOS.com** (GoDaddy) to the live app.

**GoDaddy click-by-click DNS:** see **`docs/GODADDY_DNS.md`** (screenshot-friendly tables and delete-conflicts checklist).

## Live status snapshot (2026-06-08)

| Item | Status |
|------|--------|
| GitHub `Trevlakin/Fallen-Sparrow-OS` | Pushed (`main`) |
| `fallensparrowos.com` DNS | GoDaddy parking A (`13.248.243.5`, `76.223.105.230`), **not** Vercel |
| `www.fallensparrowos.com` | CNAME → apex (parking) |
| `api.fallensparrowos.com` | **Missing** (NXDOMAIN) |
| Railway API | Not confirmed live (no custom domain; default `*.up.railway.app` URL unknown) |
| Vercel frontend | Custom domain not configured (no `_vercel` TXT) |
| Local `.env` deploy tokens | `RAILWAY_TOKEN` and `VERCEL_TOKEN` **not** set |

**To go live:** Railway + Vercel deploy first → add custom domains in each dashboard → update GoDaddy per **`docs/GODADDY_DNS.md`**.

---

| Host | Service | Purpose |
|------|---------|---------|
| `fallensparrowos.com` | Vercel | Owner/manager PWA + staff checklist |
| `www.fallensparrowos.com` | Vercel | Redirects to apex |
| `api.fallensparrowos.com` | Railway | API, webhooks, QuickBooks OAuth |

## Architecture

```
Browser → https://fallensparrowos.com
              ├── static SPA (Vercel)
              └── /api/* proxied → https://api.fallensparrowos.com (Railway)

Webhooks / OAuth → https://api.fallensparrowos.com directly
```

The Vercel proxy in `web/vercel.json` means the frontend can call `/api/...` on the same domain (no CORS issues on the main app).

---

## Step 1 — Hosting accounts (one-time)

1. **Railway:** [railway.app](https://railway.app) → New Project → Deploy from GitHub (this repo root).
2. Add **PostgreSQL** plugin on Railway.
3. **Vercel:** [vercel.com](https://vercel.com) → Import this repo, root directory **`web`**.

Create CLI tokens (for scripted deploy):

- Railway: [railway.com/account/tokens](https://railway.com/account/tokens) → `RAILWAY_TOKEN`
- Vercel: [vercel.com/account/tokens](https://vercel.com/account/tokens) → `VERCEL_TOKEN`

Add to your local `.env` (never commit):

```bash
RAILWAY_TOKEN=...
VERCEL_TOKEN=...
```

---

## Step 2 — Railway environment variables

In Railway → your API service → **Variables**:

| Variable | Production value |
|----------|------------------|
| `NODE_ENV` | `production` |
| `APP_BASE_URL` | `https://api.fallensparrowos.com` |
| `WEB_APP_URL` | `https://fallensparrowos.com` |
| `WEB_APP_ALLOWED_ORIGINS` | `https://www.fallensparrowos.com` |
| `QBO_REDIRECT_URI` | `https://api.fallensparrowos.com/api/quickbooks/callback` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `DATABASE_URL` | from Postgres plugin |
| `ANTHROPIC_API_KEY` | your key |
| (others) | copy from `.env.example` as needed |

After first deploy, run migrations in Railway shell:

```bash
pnpm db:migrate
pnpm db:seed   # demo data only; skip in real prod if you prefer
```

---

## Step 3 — Deploy from your machine

```bash
export RAILWAY_TOKEN=...
export VERCEL_TOKEN=...
bash scripts/connect-domain.sh
```

Or manually:

```bash
pnpm install && pnpm build
bash scripts/deploy-production.sh
```

---

## Step 4 — Custom domains on Vercel + Railway

### Vercel (frontend)

1. Vercel project → **Settings** → **Domains**
2. Add `fallensparrowos.com` and `www.fallensparrowos.com`
3. Vercel shows DNS records to add at GoDaddy (see Step 5)

### Railway (API)

1. Railway service → **Settings** → **Networking** → **Custom Domain**
2. Add `api.fallensparrowos.com`
3. Railway shows a **CNAME target** (e.g. `something.up.railway.app`)

---

## Step 5 — GoDaddy DNS records

**Full walkthrough:** **`docs/GODADDY_DNS.md`**.

Summary (use exact targets Vercel/Railway show if they differ):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| **A** | `@` | `76.76.21.21` | 600 (Vercel apex) |
| **CNAME** | `www` | `cname.vercel-dns.com` | 600 |
| **CNAME** | `api` | `<Railway CNAME from Networking → Custom Domain>` | 600 |

**Delete first:** GoDaddy parking A records on `@` (`13.248.243.5`, `76.223.105.230`) and CNAME `www` → `fallensparrowos.com`.

**Notes:**

- DNS propagation can take 5 minutes to 48 hours (usually under 1 hour).
- SSL certificates are issued automatically by Vercel and Railway once DNS resolves.
- Railway CNAME is **per service**; copy it only from your Railway dashboard after adding `api.fallensparrowos.com`.

---

## Step 6 — Verify

```bash
curl -s https://api.fallensparrowos.com/health
# {"status":"ok",...}

curl -sI https://fallensparrowos.com
# HTTP 200

curl -sI https://www.fallensparrowos.com
# HTTP 301 → fallensparrowos.com
```

Phone smoke test:

1. Open **https://fallensparrowos.com**
2. Log in: `owner@fallensparrow.local` / `ChangeMe123!` (if seeded)
3. Open **https://fallensparrowos.com/sop-checklist** for staff PIN flow
4. iOS: Share → Add to Home Screen

---

## Production URLs (fill in after go-live)

```
App:        https://fallensparrowos.com
Staff PWA:  https://fallensparrowos.com/sop-checklist
API:        https://api.fallensparrowos.com
Health:     https://api.fallensparrowos.com/health
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Site not loading | Wait for DNS; check GoDaddy records match Vercel/Railway exactly |
| API 502 on Railway | Check deploy logs; confirm `PORT` is set by Railway |
| Login works locally, fails on prod | Run `pnpm db:migrate` on Railway; confirm seed or real users exist |
| CORS errors | Set `WEB_APP_URL` and `WEB_APP_ALLOWED_ORIGINS` on Railway |
| `/api` fails on Vercel but direct API works | Confirm `api.fallensparrowos.com` resolves and `web/vercel.json` rewrite target is correct |
