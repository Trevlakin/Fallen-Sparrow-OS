# Railway troubleshooting: "I don't see the project"

Use this when code is on GitHub but nothing appears in the [Railway dashboard](https://railway.app/dashboard).

**Most common cause:** Pushing to GitHub does **not** create a Railway project. You must connect the repo once in Railway (Deploy from GitHub).

**Related:** [`docs/RAILWAY_GITHUB_DEPLOY.md`](./RAILWAY_GITHUB_DEPLOY.md) (full deploy guide), [`docs/GODADDY_DNS.md`](./GODADDY_DNS.md) (DNS after deploy).

---

## Quick diagnosis

| What you did | What Railway does |
|--------------|-------------------|
| `git push` to GitHub only | Nothing. No project is created automatically. |
| **New Project → Deploy from GitHub** → select repo | Creates project + first deploy |
| Push after project is linked | Auto-redeploy on each push to connected branch |

| Symptom | Likely cause |
|---------|----------------|
| Empty Railway dashboard / no projects | Never clicked **Deploy from GitHub** |
| Repo missing in repo picker | Railway GitHub App not installed or repo not granted |
| Project exists but under another name | Wrong Railway account, team, or workspace |
| Build fails after project appears | Env vars, build logs (see bottom of this doc) |

---

## Fix in ~5 minutes (dashboard path, no CLI token)

### 1. Confirm GitHub repo is live

Open: [github.com/Trevlakin/Fallen-Sparrow-OS](https://github.com/Trevlakin/Fallen-Sparrow-OS)

You should see:

- Default branch: **`main`**
- Files at repo root: `railway.toml`, `nixpacks.toml`, `package.json`

If the repo is private, you must grant Railway access in step 2.

### 2. Install or configure the Railway GitHub App

1. Go to [railway.app](https://railway.app) and sign in with the **same GitHub account** that owns `Trevlakin/Fallen-Sparrow-OS` (or a team member with repo access).
2. Click your **avatar** (top right) → **Account Settings** → **Connections** (or go to [railway.app/account/connections](https://railway.app/account/connections)).
3. Under **GitHub**, click **Configure** or **Connect**.
4. GitHub opens **Install Railway** or **Configure Railway**:
   - **All repositories**, or
   - **Only select repositories** → add **`Fallen-Sparrow-OS`**
5. Save. Return to Railway.

**Screenshot checkpoint:** GitHub → **Settings** → **Applications** → **Installed GitHub Apps** → **Railway** shows access to `Trevlakin/Fallen-Sparrow-OS`.

### 3. Create the project from GitHub

1. Railway dashboard → **+ New** (or **New Project**).
2. Choose **Deploy from GitHub repo** (not Empty Project, not Docker unless you know you need it).
3. If prompted, finish GitHub authorization from step 2.
4. Search and select **`Trevlakin/Fallen-Sparrow-OS`**.
5. **Root directory:** leave as **`.`** (repository root). Do **not** set `server/` or `web/`.
6. Confirm deploy starts (Nixpacks should pick up `railway.toml` / `nixpacks.toml`).

**Screenshot checkpoint:** Project canvas shows a **service** linked to GitHub with branch **`main`** and a **Deployments** tab with a building or successful deploy.

### 4. Add PostgreSQL

1. Inside the project → **+ New** → **Database** → **PostgreSQL**.
2. Open the **API/web service** (Node app, not Postgres) → **Variables**.
3. Ensure **`DATABASE_URL`** is set (Railway often links it when both services share a project; verify it exists on the API service).

### 5. Minimum env vars (API service)

Railway → API service → **Variables**. Required for boot:

| Variable | Example / source |
|----------|------------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | From Postgres service |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `APP_BASE_URL` | Railway default URL first, then `https://api.fallensparrowos.com` |
| `WEB_APP_URL` | `https://fallensparrowos.com` (or Vercel URL until domain is live) |

Redeploy after adding variables. Full list: [`RAILWAY_GITHUB_DEPLOY.md` § Step 4](./RAILWAY_GITHUB_DEPLOY.md#step-4-environment-variables-api-service).

### 6. Run migrations

Railway → API service → **Settings** → **Shell**:

```bash
pnpm db:migrate
```

---

## What success looks like

After steps 3–6:

1. **Dashboard:** A project (you can rename it, e.g. `fallen-sparrow-api`) with at least two services: **Postgres** + **Node API**.
2. **Deployments:** Latest deploy status **Success** (green).
3. **Networking:** Service has a public URL like `https://something.up.railway.app`.
4. **Health:**

```bash
curl -s https://YOUR-RAILWAY-URL.up.railway.app/health
```

Expect JSON with a healthy status (exact shape depends on your `/health` handler).

5. **GitHub:** Further pushes to **`main`** trigger new deploys without redoing "New Project".

---

## Still don't see the repo or project?

### Wrong Railway account or workspace

- Sign out of Railway and sign back in with GitHub user **`Trevlakin`** (or the org that owns the repo).
- Top-left **workspace switcher**: check **Personal** vs **Team** workspaces. Projects do not show across accounts.

### Repo not in the picker

- Re-run [GitHub App configuration](#2-install-or-configure-the-railway-github-app) and explicitly add `Fallen-Sparrow-OS`.
- On GitHub: **Settings** → **Applications** → **Railway** → **Configure** → repository access.

### Expected CLI path (optional, not required for first deploy)

`RAILWAY_TOKEN` is **not** in local `.env` by default. GitHub deploy does **not** need it.

Use a token only for `railway link`, `railway run`, or `scripts/deploy-production.sh`:

1. [railway.com/account/tokens](https://railway.com/account/tokens) → create token.
2. Add to local `.env`: `RAILWAY_TOKEN=...` (never commit).
3. `railway whoami`, `railway list`, `railway link`.

If you never created a project in the dashboard, `railway list` may be empty even with a valid token.

---

## Build / runtime issues (project exists)

| Symptom | What to check |
|---------|----------------|
| Build fails | **Deployments** → failed deploy → **View logs**. Run locally: `bash scripts/railway-github-bootstrap.sh --verify-build` |
| Crash on start | Logs for missing `JWT_SECRET`, `DATABASE_URL`, or bad `APP_BASE_URL` / `WEB_APP_URL` |
| `/health` 502 | Deploy still running? Postgres up? `DATABASE_URL` on API service? |
| CORS from browser | `WEB_APP_URL`, `WEB_APP_ALLOWED_ORIGINS` on Railway |

---

## Checklist (copy for Legion)

- [ ] Repo live on GitHub: `Trevlakin/Fallen-Sparrow-OS`, branch `main`
- [ ] Railway GitHub App installed with access to this repo
- [ ] **New Project → Deploy from GitHub** → selected repo, root `.`
- [ ] PostgreSQL plugin added; `DATABASE_URL` on API service
- [ ] Required env vars set; redeploy succeeded
- [ ] `pnpm db:migrate` in Railway shell
- [ ] `/health` returns OK on Railway URL
