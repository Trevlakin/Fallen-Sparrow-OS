# GoDaddy DNS for FallenSparrowOS.com

Copy-paste guide for pointing **FallenSparrowOS.com** at Vercel (frontend) and Railway (API). Do this **after** Railway and Vercel projects exist and show you their DNS targets.

**Related:** `docs/DOMAIN_SETUP.md` (full stack), `docs/RAILWAY_GITHUB_DEPLOY.md` (Railway from GitHub).

---

## Current status (checked 2026-06-08)

| Check | Result |
|-------|--------|
| `fallensparrowos.com` A | `13.248.243.5`, `76.223.105.230` (GoDaddy parking, **not** Vercel) |
| `www` | CNAME → `fallensparrowos.com` (GoDaddy default) |
| `api.fallensparrowos.com` | **No DNS record** (does not resolve) |
| HTTPS on apex | GoDaddy DPS parking page (`Server: DPS/2.0.0`) |
| Vercel domain verification | No `_vercel` TXT record found |
| `RAILWAY_TOKEN` / `VERCEL_TOKEN` in local `.env` | **Not set** (dashboard deploy path required) |

**Blockers before DNS will work:** deploy API on Railway, deploy frontend on Vercel, add custom domains in both dashboards, then replace GoDaddy parking records below.

---

## Order of operations

1. **Railway:** Deploy API from GitHub → add Postgres → set env vars → run migrations → add custom domain `api.fallensparrowos.com` → copy the **CNAME target** Railway shows.
2. **Vercel:** Import repo, root `web/` → production deploy → add domains `fallensparrowos.com` and `www.fallensparrowos.com`.
3. **GoDaddy:** Update DNS records (this doc).
4. **Wait:** 5–60 minutes (up to 48h) for propagation.
5. **Verify:** curl checks at bottom.

---

## GoDaddy: open DNS management

1. Go to [godaddy.com](https://www.godaddy.com) and sign in.
2. **My Products** (or **Domain Portfolio**).
3. Find **FallenSparrowOS.com** → **DNS** (or **Manage DNS**).
4. Scroll to **DNS Records**.

You should see nameservers like `ns75.domaincontrol.com` and `ns76.domaincontrol.com`. Leave those alone unless you move DNS elsewhere.

---

## Step 1: Remove conflicting records

Delete or edit anything that blocks the new setup:

| Look for | Action |
|----------|--------|
| **A** record, Name `@` or blank, pointing to GoDaddy IPs (e.g. `13.248.243.5`, `76.223.105.230`, `Parked`) | **Delete** both A records on `@` |
| **CNAME** `www` → `fallensparrowos.com` | **Delete** (replace in Step 3) |
| **A** or **CNAME** for `api` | Delete old values before adding Railway CNAME |
| GoDaddy **Forwarding** on the domain | Turn off if it conflicts with Vercel |
| **Website Builder** / parking on this domain | Disable or disconnect so DNS controls the site |

---

## Step 2: Add apex + www (Vercel)

Click **Add** (or **Add New Record**) for each row:

### Record 1: Apex → Vercel

| Field | Value |
|-------|-------|
| **Type** | A |
| **Name** | `@` (or leave blank; GoDaddy means root domain) |
| **Value** | `76.76.21.21` |
| **TTL** | 600 seconds (or 1/2 hour; default is fine) |

### Record 2: www → Vercel

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name** | `www` |
| **Value** | `cname.vercel-dns.com` |
| **TTL** | 600 |

**Note:** If Vercel dashboard shows a different apex method (e.g. ALIAS or another A record), use **exactly** what Vercel shows under Project → Settings → Domains. For most GoDaddy + Vercel setups, `76.76.21.21` and `cname.vercel-dns.com` are correct.

---

## Step 3: Add api subdomain (Railway)

You must get the CNAME target from Railway first:

1. [railway.app](https://railway.app) → your API service → **Settings** → **Networking** → **Custom Domain**.
2. Enter `api.fallensparrowos.com`.
3. Railway displays a target like `your-service-name.up.railway.app` (yours will differ).

In GoDaddy, add:

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name** | `api` |
| **Value** | `<paste Railway CNAME target here>` |
| **TTL** | 600 |

**Do not guess** the Railway hostname. It is unique per service. After you add the domain in Railway, paste the exact string from the dashboard into GoDaddy.

---

## Final DNS table (after edits)

| Type | Name | Points to | Purpose |
|------|------|-----------|---------|
| A | `@` | `76.76.21.21` | SPA on Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | www → Vercel (redirect to apex in `web/vercel.json`) |
| CNAME | `api` | `<from Railway dashboard>` | API on Railway |

---

## Optional: Vercel verification TXT

If Vercel asks for domain ownership before going live, add the TXT record it shows (often on `_vercel` or the apex). Remove it after verification if Vercel no longer requires it.

Example (your value will differ):

| Type | Name | Value |
|------|------|-------|
| TXT | `_vercel` | `vc-domain-verify=...` |

---

## Verify (run from your machine)

```bash
# DNS
dig +short fallensparrowos.com A
# expect: 76.76.21.21

dig +short www.fallensparrowos.com CNAME
# expect: cname.vercel-dns.com.

dig +short api.fallensparrowos.com CNAME
# expect: something.up.railway.app.

# HTTP
curl -s https://api.fallensparrowos.com/health
# expect: {"status":"ok",...}

curl -sI https://fallensparrowos.com | head -5
# expect: HTTP/2 200, server often includes vercel

curl -sI https://www.fallensparrowos.com | grep -i location
# expect: redirect to https://fallensparrowos.com/
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Still see GoDaddy parking | Old A records on `@` not removed; wait for TTL; try incognito |
| Vercel "Invalid Configuration" | Apex A must be `76.76.21.21`; www CNAME must be `cname.vercel-dns.com` |
| `api` does not resolve | CNAME for `api` missing or typo; confirm name is `api` not `api.fallensparrowos.com` |
| API SSL error on Railway | DNS must point to Railway CNAME before cert issues; wait 15–30 min |
| App loads but login fails | Run `pnpm db:migrate` on Railway; check `JWT_SECRET`, `DATABASE_URL` |
| `/api` 502 on main site | `api.fallensparrowos.com` must work directly first; see `web/vercel.json` |

---

## CLI deploy (optional, after tokens in `.env`)

```bash
# Add to .env (never commit):
# RAILWAY_TOKEN=...
# VERCEL_TOKEN=...

bash scripts/connect-domain.sh
```

That script deploys, sets production URLs on Railway, and prints this DNS summary again.
