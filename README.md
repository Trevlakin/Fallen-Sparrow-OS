# Fallen Sparrow Tattoo Studio Management System

Monorepo for the Fallen Sparrow build (MASTER_SPEC_v3). **Canonical folder:** `Fallen Sparrow Holy SHIT package` (a `fallen-sparrow` symlink points here for older chats).

**Build status:** Sprints 1–3 complete; Sprint 2 webhook + Sprint 4 brain dump added. `pnpm typecheck` and `pnpm build` pass. DB migrate/seed/tests need local Postgres + Docker.

## Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 16 (local or Docker)

## Quick start

```bash
cd "/Users/trevorl/Desktop/Cursor Projects/Fallen Sparrow Holy SHIT package"
pnpm install
cp .env.example .env
# Edit .env: set DATABASE_URL and JWT_SECRET (see below)

# Start Postgres (if needed)
docker run -d --name fallen-sparrow-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=fallen_sparrow \
  -p 5432:5432 postgres:16

pnpm --filter @fallen-sparrow/shared build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Generate a JWT secret:

```bash
openssl rand -hex 32
```

Local `DATABASE_URL` example:

```
postgresql://postgres:postgres@localhost:5432/fallen_sparrow
```

## Deploy (production)

See **[DEPLOY.md](./DEPLOY.md)** for Railway (API + Postgres), Netlify (frontend), env checklist, and migrations.

Quick health check after deploy: `GET /health` on your Railway URL.

## API

- `GET /` — service info
- `GET /health` — Railway health check
- `GET /api/health` — health check (API prefix)
- `POST /api/auth/login` — `{ "email", "password" }`
- `GET /api/auth/me` — Bearer token required
- `POST /api/porter/ingest/csv` — OWNER/MANAGER, body `{ "csv": "..." }`
- `GET /api/metrics/daily?date=YYYY-MM-DD` — all roles
- `GET /api/metrics/weekly?start=YYYY-MM-DD&end=YYYY-MM-DD` — all roles
- `GET /api/metrics/monthly?year=YYYY&month=M` — OWNER/MANAGER
- `POST /api/porter/ingest/webhook` — Resend inbound (public; requires `RESEND_INBOUND_WEBHOOK_SECRET`)
- `POST /api/brain-dump` — parse brain dump (all roles)
- `GET /api/brain-dump/suggestions` — OWNER/MANAGER
- `POST /api/brain-dump/suggestions/:id/promote` — OWNER/MANAGER
- `DELETE /api/brain-dump/suggestions/:id` — OWNER/MANAGER

Seed owner: `owner@fallensparrow.local` / `ChangeMe123!`

Run tests (requires Postgres + seed): `pnpm test`

Sprint 4 briefing synthesis service exists (`briefingSynthesisService.ts`) but no HTTP routes yet — wire in Sprint 7 with Resend send.

## Docs

- `docs/MASTER_SPEC_v3.md` — primary authority
- `.cursor/rules/` — guardrails and architecture
