# Railway Environment Variables - Fallen Sparrow OS

**After pasting these, set DATABASE_URL as `${{Postgres.DATABASE_URL}}` reference (not a plain string).**

Paste all of the following into the Railway "Variables" panel for the **@fallen-sparrow/server** service.
Set each key/value pair individually, or use Railway's bulk-paste (raw editor) feature.

---

## Variables

```
NODE_ENV=production
OWNER_SEED_EMAIL=admin@fallensparrowos.com
OWNER_SEED_PASSWORD=ChangeMe123!
JWT_SECRET=93feed4044a68f9db354b91d243abcdb6b4a1a90b58e9bf601ed4398938e311c
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
APP_BASE_URL=https://api.fallensparrowos.com
WEB_APP_URL=https://www.fallensparrowos.com
WEB_APP_ALLOWED_ORIGINS=https://fallensparrowos.com
DEFAULT_TIMEZONE=America/New_York
DATABASE_URL=${{Postgres.DATABASE_URL}}
ANTHROPIC_API_KEY=<REDACTED - copy from your local .env>
ANTHROPIC_MODEL=claude-sonnet-4-6
QBO_CLIENT_ID=ABIhgtRb9PFwDvV17RktJ3Wryq2n6gyBiwso9OTdpLniA0kmdl
QBO_CLIENT_SECRET=rEdkV1OxwxamU7IPTHykOQOGS7Ss0gWLUmqBHTuW
QBO_REDIRECT_URI=https://api.fallensparrowos.com/api/quickbooks/callback
QBO_ENVIRONMENT=sandbox
QBO_REALM_ID=
```

---

## Notes

- **DATABASE_URL**: Do NOT paste a plain connection string. In Railway, click "Add Variable", set
the key to `DATABASE_URL`, and set the value to the reference `${{Postgres.DATABASE_URL}}`.
This ensures Railway automatically injects the correct internal Postgres URL.
- **Auto-migrate on boot**: The API starts immediately; `pnpm db:migrate` runs in the background
(via `scripts/railway-boot.sh`) so health checks pass while Postgres connects. You do not need
Railway Shell for migrations unless auto-migrate fails in deploy logs.
- **Auto-seed on boot**: When `OWNER_SEED_EMAIL` and `OWNER_SEED_PASSWORD` are set, the API runs
`pnpm db:seed` after migrate on every deploy. Seed is idempotent: it creates the owner only if
missing. Manual shell seed is optional.
- **ANTHROPIC_API_KEY**: This key was previously exposed in a chat log. You should rotate it at
[console.anthropic.com](https://console.anthropic.com) and update this value (and Railway) with
the new key as soon as possible.
- **APP_BASE_URL**: Set to `https://api.fallensparrowos.com` (the API server's own base URL, used for OAuth callbacks and CORS). Update only if the Railway custom domain changes.
- **WEB_APP_URL**: Set to `https://www.fallensparrowos.com` (Railway web service). Used for CORS.
- **OWNER_SEED_EMAIL / OWNER_SEED_PASSWORD**: Required for first owner login in production.
Initial: `admin@fallensparrowos.com` / `ChangeMe123!` (Legion should change this after first sign-in).
- **QBO_REDIRECT_URI**: Updated from localhost to the production URL. Ensure this URI is registered
in your QuickBooks Developer app settings (Intuit Developer Portal) or OAuth callbacks will fail.
- **QBO_REALM_ID**: Leave blank until QuickBooks OAuth is connected in production.
- **JWT_SECRET**: Freshly rotated on 2026-06-08. The old value is invalidated.

---

## First login (503 / "Connecting..." on www)

If login returns 503 or the app says the database is unavailable:

1. Railway project → confirm a **PostgreSQL** service exists and the **API service** has `DATABASE_URL=${{Postgres.DATABASE_URL}}`.
2. Confirm **OWNER_SEED_EMAIL** and **OWNER_SEED_PASSWORD** are set on the API service (see Variables above).
3. **Redeploy the API service** (Deploy → Redeploy). Boot runs migrate + seed automatically; check deploy logs for `Railway boot: running database migrations`.
4. Sign in with `OWNER_SEED_EMAIL` / `OWNER_SEED_PASSWORD` (default `admin@fallensparrowos.com` / `ChangeMe123!` until changed).

Manual fallback (only if auto-migrate fails in logs): API service → **Settings** → **Shell**:

```bash
pnpm db:migrate
pnpm db:seed
```

Verify: `curl -X POST https://api.fallensparrowos.com/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@fallensparrowos.com","password":"ChangeMe123!"}'` should return `200` with a token, not `503`.
