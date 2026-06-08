# Fallen Sparrow: Railway-Only (Recommended)

One platform. One bill. One dashboard. No Vercel.

```
fallensparrowos.com        → Railway @fallen-sparrow/web  (the app)
api.fallensparrowos.com    → Railway @fallen-sparrow/server (API)
Postgres                   → Railway (all history/data)
GoDaddy                    → DNS only (you manage this)
```

## What lives where

| Piece | Railway service | Custom domain |
|-------|-----------------|---------------|
| React app (PWA) | `@fallen-sparrow/web` | `fallensparrowos.com` |
| Express API | `@fallen-sparrow/server` | `api.fallensparrowos.com` |
| Database | `Postgres` | (internal only) |

## Railway dashboard checklist

### Server (`@fallen-sparrow/server`)

1. **Variables** — see `docs/RAILWAY_ENV_VARS.md`
2. **Networking** → **+ Custom Domain** → `api.fallensparrowos.com` → copy CNAME target
3. **Shell** (one time): `pnpm db:migrate`

### Web (`@fallen-sparrow/web`)

1. **Settings** → **Root Directory:** leave **empty** (repo root `.`) OR set to `web`. Both work:
   - Repo root: `scripts/railway-build.sh` / `scripts/railway-start.sh` use `RAILWAY_SERVICE_NAME` (must contain `web`) to build and serve the SPA.
   - `web/`: uses `web/nixpacks.toml`, `web/Procfile`, and `web/scripts/start-production.sh`.
2. **Settings** → confirm **Start Command** is empty (let `railway.toml` / Nixpacks run) OR explicitly `sh scripts/start-production.sh` if Root Directory is `web`.
3. **Settings** → **Build Command:** leave empty unless overriding; should **not** run `pnpm --filter @fallen-sparrow/server`.
4. **Networking** → **+ Custom Domain** → `www.fallensparrowos.com` (and apex if needed) → copy CNAME target
5. After deploy, build logs should show `Railway build: @fallen-sparrow/web` and start logs `serve` on `PORT`.

No extra env vars needed on web. The build bakes in `VITE_API_BASE_URL=https://api.fallensparrowos.com`.

**If www still returns API JSON (`x-powered-by: Express`):** the web service is running the server start command. Open web service → **Deployments** → latest → **View logs** and confirm you see the web build line above, not only server TypeScript compile. Then **Redeploy** (or push to `main`).

### Delete nothing

Keep both web + server services. That is the whole stack.

## GoDaddy DNS (you handle this)

**Delete parking records first:**

- A `@` → `13.248.243.5`
- A `@` → `76.223.105.230`
- CNAME `www` → `fallensparrowos.com` (if it points at parking)

**Add (use exact targets from Railway Networking tabs):**

| Type | Name | Value | Service |
|------|------|-------|---------|
| CNAME | `api` | `<server CNAME from Railway>` | server |
| CNAME | `@` or `www` | `<web CNAME from Railway>` | web |

GoDaddy apex (`@`) sometimes needs a **forward** to `www` if CNAME on `@ is not supported. Railway shows the exact record type they need when you add each custom domain.

## Verify

```bash
curl -s https://api.fallensparrowos.com/health
# {"status":"ok",...}

# Browser
https://fallensparrowos.com
https://fallensparrowos.com/sop-checklist
```

## Updates (no domino effect)

| Action | What happens | Data safe? |
|--------|--------------|------------|
| Push to GitHub `main` | Railway auto-redeploys web + server | Yes (Postgres unchanged) |
| Code deploy | New containers, same database | Yes |
| `pnpm db:migrate` | Adds schema, keeps rows | Yes |
| Postgres plugin stays up | All history preserved | Yes |

**Never** delete the Postgres service. **Never** run `pnpm db:seed` in production after go-live.

## Optional CLI deploy

Add `RAILWAY_TOKEN` to `.env`, then:

```bash
bash scripts/connect-domain-railway.sh
```
