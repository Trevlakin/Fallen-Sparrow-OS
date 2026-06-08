# Railway Environment Variables - Fallen Sparrow OS

**After pasting these, set DATABASE_URL as `${{Postgres.DATABASE_URL}}` reference (not a plain string).**

Paste all of the following into the Railway "Variables" panel for the **@fallen-sparrow/server** service.
Set each key/value pair individually, or use Railway's bulk-paste (raw editor) feature.

---

## Variables

```
NODE_ENV=production
JWT_SECRET=93feed4044a68f9db354b91d243abcdb6b4a1a90b58e9bf601ed4398938e311c
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
APP_BASE_URL=https://api.fallensparrowos.com
WEB_APP_URL=https://fallensparrowos.com
DEFAULT_TIMEZONE=America/New_York
DATABASE_URL=${{Postgres.DATABASE_URL}}
ANTHROPIC_API_KEY=<REDACTED - copy from your local .env>
ANTHROPIC_MODEL=claude-sonnet-4-6
QBO_CLIENT_ID=ABIhgtRb9PFwDvV17RktJ3Wryq2n6gyBiwso9OTdpLniA0kmdl
QBO_CLIENT_SECRET=rEdkV1OxwxamU7IPTHykOQOGS7Ss0gWLUmqBHTuW
QBO_REDIRECT_URI=https://fallensparrowos.com/api/quickbooks/callback
QBO_ENVIRONMENT=sandbox
QBO_REALM_ID=
```

---

## Notes

- **DATABASE_URL**: Do NOT paste a plain connection string. In Railway, click "Add Variable", set
the key to `DATABASE_URL`, and set the value to the reference `${{Postgres.DATABASE_URL}}`.
This ensures Railway automatically injects the correct internal Postgres URL.
- **ANTHROPIC_API_KEY**: This key was previously exposed in a chat log. You should rotate it at
[console.anthropic.com](https://console.anthropic.com) and update this value (and Railway) with
the new key as soon as possible.
- **APP_BASE_URL**: Set to `https://api.fallensparrowos.com` (the API server's own base URL, used for OAuth callbacks and CORS). Update only if the Railway custom domain changes.
- **WEB_APP_URL**: Set to `https://fallensparrowos.com` (the Vercel-hosted frontend). Used for CORS allowed origins and redirect URLs.
- **QBO_REDIRECT_URI**: Updated from localhost to the production URL. Ensure this URI is registered
in your QuickBooks Developer app settings (Intuit Developer Portal) or OAuth callbacks will fail.
- **QBO_REALM_ID**: Leave blank until QuickBooks OAuth is connected in production.
- **JWT_SECRET**: Freshly rotated on 2026-06-08. The old value is invalidated.

