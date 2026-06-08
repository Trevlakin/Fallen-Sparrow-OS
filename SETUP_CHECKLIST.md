# SETUP CHECKLIST — BEFORE SPRINT 1

Do these in order. Items marked **[you]** need a human; **[Cursor]** can be delegated.

---

## 1. Provision accounts & keys  **[you]**

You don't need all of these for Sprint 1 (schema + auth) — only Database, Auth, and Sentry. The
rest can be filled in as you reach the sprint that uses them (the `.env.example` marks which sprint
each belongs to). But creating the accounts early avoids mid-build stalls.

- [ ] **Railway** — PostgreSQL instance → `DATABASE_URL`  *(Sprint 1)*
- [ ] **JWT secret** — `openssl rand -hex 32` → `JWT_SECRET`  *(Sprint 1)*
- [ ] **Sentry** — project → `SENTRY_DSN`  *(Sprint 1)*
- [ ] **Anthropic** — API key → `ANTHROPIC_API_KEY`  *(Sprint 4)*
- [ ] **Resend** — API key + verified sending domain + inbound address  *(Sprint 2 & 7)*
- [ ] **Cloudflare R2** — bucket + access keys  *(Sprint 4)*
- [ ] **Twilio** — account SID/token + phone number  *(Sprint 7)*
- [ ] **QuickBooks Online** — Trevor creates the app at developer.intuit.com (Client ID + Secret,
      test in sandbox). Legion's QB admin does the one-time OAuth consent in production. *(Sprint 4/5)*
- [ ] **Zapier** — account for the Porter→CSV→Resend daily export  *(Sprint 2)*

## 2. Create the env file  **[you]**

- [ ] Copy `.env.example` → `.env`, fill in what you have. Leave the rest blank; `config/env.ts`
      will tell you (at boot) exactly what's missing for the sprint you're on.
- [ ] Confirm `.env` is in `.gitignore`. Never commit it.

## 3. Drop in the reference code  **[you]**

- [ ] Unzip GCOps source → `reference/gcops-source/`
- [ ] Unzip B.O.S.S. source → `reference/boss-source/`
- [ ] Confirm `reference/` is git-ignored or clearly marked read-only (it's example code, not part
      of the build).

## 4. Confirm repo structure  **[you, with Cursor]**

The specs describe an Express backend, a React web dashboard, an Expo mobile app, and a shared
schema/constants layer. **Recommended: a single monorepo with workspaces**, because `shared/` must
be the one source of truth imported by all three apps — that's the cleanest way to prevent crossed
wires. This layout matches the path references already in MASTER_SPEC_v3 §3 and the reference code:

```
/fallen-sparrow                 (monorepo root — npm or pnpm workspaces)
├── /shared                     schema.ts, constants.ts, types, zod schemas (imported everywhere)
├── /server                     Express API
│   ├── /config                 env.ts (validated), database.ts
│   ├── /routes                 HTTP only
│   ├── /controllers            thin orchestration + Zod validation
│   ├── /services               ALL business logic
│   ├── /repos                  ALL Drizzle/db access
│   ├── /integrations           one module per vendor (anthropic, porter, qb, twilio, resend, storage)
│   ├── /jobs                    node-cron (porter sync, briefing, weekly report, qb retry)
│   ├── /middleware             auth, rbac, tenant, error, logger
│   ├── /lib                     profit/margin, etc.
│   └── /utils                   errors (AppError), logger, formatters
├── /web                        React + Vite dashboard
├── /mobile                     Expo React Native
├── /docs                       the three spec files
├── /reference                  GCOps + B.O.S.S. (read-only)
├── /.cursor/rules              the four .mdc rules
├── .env.example
└── package.json                (workspaces)
```

- [ ] Confirm this structure with Trevor, or have Cursor scaffold it as the first task. The
      architecture rule (`03-architecture.mdc`) enforces the layering inside `/server` regardless.

## 5. Open in Cursor & verify rules  **[you]**

- [ ] Open the repo root in Cursor.
- [ ] In Composer, type `/rules` and confirm all four load:
      `00-project-guardrails` (always), `03-architecture` (always),
      `01-ai-grounding` (on AI work), `02-extraction` (on extraction work).
- [ ] If they don't appear, confirm `.cursor/rules/` is at the repo root Cursor opened.

## 6. First Cursor tasks  **[Cursor]**

1. Scaffold the monorepo structure above (workspaces, TypeScript strict, Drizzle, Zod).
2. Build `config/env.ts` (Zod-validated env, fails fast) FIRST — everything depends on it.
3. Build `shared/schema.ts` from MASTER_SPEC_v3 §3 and `shared/constants.ts` from §4.
4. Generate the initial Drizzle migration; confirm it applies to the Railway DB.
5. Build auth (JWT + bcrypt, 4 roles) + tenant middleware.
6. → That completes **Sprint 1**. Proceed down the roadmap (v3 §11) in order.

---

## DON'T LET CURSOR FABRICATE (open items — v3 §12)

These have no answer yet. Cursor must mark `// TODO(Q1d): ...` and keep moving — never invent them:

- **Q1d** — Porter API / QB integration / appointment-level export / walk-in attribution field.
  Default path: Zapier CSV daily + our own QB sync. Resolve before Sprint 2 ships to production.
- **Commission rates** per service type + walk-in/referral bonus amounts → seed placeholders in
  `settings`, surface "confirm rates" in the UI.
- **Bookkeeper relationship** — does QB sync replace the middleman or feed them?
- **Drizzle vs Prisma** final sign-off — proceeding with Drizzle unless Trevor vetoes.
