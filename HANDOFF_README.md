# FALLEN SPARROW — CURSOR HANDOFF PACKAGE

**Read this first.** This package is everything Cursor needs to build the Fallen Sparrow Tattoo
Studio Management System without drifting off-plan. Drop it into your repo root and you're ready.

---

## WHAT'S IN THIS PACKAGE

```
fallen-sparrow-handoff/
├── HANDOFF_README.md              ← you are here (for humans)
├── SETUP_CHECKLIST.md             ← the bootstrap sequence before Sprint 1
├── .env.example                   ← every env var, grouped + commented (copy to .env)
├── .cursor/
│   └── rules/
│       ├── 00-project-guardrails.mdc   ← ALWAYS loaded. The anti-drift core (stack, source-of-truth, hard nevers).
│       ├── 03-architecture.mdc         ← ALWAYS loaded. The anti-spaghetti spine (layering, boundaries, SSOT).
│       ├── 01-ai-grounding.mdc         ← loaded for AI/brain-dump/briefing work
│       └── 02-extraction.mdc           ← loaded for reference-code extraction
└── docs/
    ├── MASTER_SPEC_v3.md          ← PRIMARY authority (decisions, stack, schema, prompts)
    ├── MASTER_SPEC_v2.md          ← feature detail (UI, pain points, tests) — v3 overrides on conflict
    └── BOSS_EXTRACTION_ANALYSIS.md ← what to extract / adapt / skip
```

**Start with `SETUP_CHECKLIST.md`** — it's the ordered bootstrap (accounts → env → reference code →
repo structure → first Cursor tasks). This README explains *what* the package is; the checklist is
*what to do with it*.

**You add two more things** (they're big and they're code, not docs):

```
├── reference/
│   ├── gcops-source/              ← unzip the GCOps brain-dump source here
│   └── boss-source/               ← unzip the B.O.S.S. source here
```

---

## SETUP IN 4 STEPS

1. **Copy this package into your repo root.** The `.cursor/rules/` folder and `docs/` folder sit at
   the top level of the project Cursor opens.

2. **Unzip the reference code into `reference/`** (GCOps → `reference/gcops-source/`, B.O.S.S. →
   `reference/boss-source/`). This is read-only example code Cursor extracts patterns from.

3. **Open the project in Cursor.** The rules load automatically — `00-project-guardrails.mdc` is
   always on; the other two activate when Cursor works on matching tasks. Type `/rules` in Composer
   to confirm they're loaded.

4. **Start Sprint 1** (DB schema + auth). Point Cursor at `docs/MASTER_SPEC_v3.md §3` and §11.

---

## THE READ ORDER (HOW THE DOCS RELATE)

| Doc | Role | When Cursor uses it |
|---|---|---|
| `MASTER_SPEC_v3.md` | **Primary.** Locked decisions, full Drizzle schema, the two Claude prompts word-for-word, Porter abstraction, commission engine, 8-sprint roadmap. | Always the first reference for any decision. |
| `MASTER_SPEC_v2.md` | Feature detail. UI layouts (mobile + desktop), the 13 pain points, inventory, SOP/task library, walk-in logging, reschedule tracking, message center, testing, code standards. | For *how a feature looks/behaves* — but only where v3 doesn't override it. |
| `BOSS_EXTRACTION_ANALYSIS.md` | Extraction map. File-by-file: extract / adapt / skip / build-new. | During Sprint 2+ when porting metrics, payroll, profit logic. |

**The one rule that governs all three:** when v3 and v2 conflict, **v3 wins.** The guardrails file
states this so Cursor can't forget it.

---

## WHAT THE GUARDRAILS PREVENT (WHY THIS PACKAGE EXISTS)

Cursor's training data will push it toward the *common* choices, which are the *wrong* choices here.
`00-project-guardrails.mdc` is built to stop exactly that. It hard-blocks:

- ❌ OpenAI / GPT  →  ✅ Anthropic Claude Sonnet 4.6 (`claude-sonnet-4-6`)
- ❌ Prisma  →  ✅ Drizzle ORM
- ❌ SendGrid  →  ✅ Resend
- ❌ JavaScript  →  ✅ TypeScript
- ❌ Customer segmentation (at-risk / goldmine / upsell / discount referrals)  →  ✅ Continuity model
- ❌ Inventing data in AI parsing  →  ✅ Grounded extraction, confidence-gated, suggestions queue
- ❌ Hardcoded expense categories  →  ✅ Single `shared/constants.ts` source
- ❌ Direct Porter calls / assumed field names  →  ✅ `PorterIngestionService` + one `mapPorterRow()`

It also enforces behavior: **if the spec is silent, Cursor asks instead of guessing**; it works the
sprint roadmap in order; it cites the spec section it's implementing; and it flags (never silently
fixes) anything it thinks the spec got wrong.

## THE SPINE — HOW WE PREVENT SPAGHETTI (`03-architecture.mdc`)

The second always-on rule is what keeps the codebase clean over a long build. It enforces:

- **Strict one-way layering:** `route → controller → service → repo → db`. Routes never touch the
  DB; services never touch `req`/`res`; repos hold no business logic. No circular imports.
- **Single sources of truth:** env only via `config/env.ts` (validated, fails fast — never
  `process.env.X` scattered around); schema only in `shared/schema.ts`; constants only in
  `shared/constants.ts`.
- **One door per vendor:** Anthropic, Porter, QuickBooks, Twilio, Resend, R2 each live behind exactly
  one integration module. Nothing else imports a vendor SDK or sees a raw vendor payload — services
  receive normalized data. This is the "no crossed wires" guarantee.
- **Validation at every boundary** (Zod), **uniform error handling** (one `AppError` + one
  middleware), **named exports only**, **no `any`**, **migrations only via Drizzle Kit**, and
  anti-debt rules (no dead reference code, rule of three, tests per module).

---

## LOCKED STACK (QUICK REFERENCE)

TypeScript · Express 5 · PostgreSQL · **Drizzle ORM** · JWT+bcrypt · **Anthropic Claude Sonnet 4.6** ·
Twilio (SMS) · **Resend** (email) · Cloudflare R2 (files) · node-cron · Railway · Vercel · Sentry · Winston · Zod

---

## OPEN ITEMS (NON-BLOCKING — DON'T LET CURSOR FABRICATE THESE)

These are flagged in v3 §12 and marked in the guardrails. They do NOT block Sprint 1.

1. **Q1d — Porter API / QB integration / appointment-level export / walk-in attribution.** Awaiting
   Legion's answer from Porter. Default: Zapier CSV daily + our own QB sync. Resolve before Sprint 2
   ships to production. All Porter column names are unconfirmed — they live in one `mapPorterRow()`.
2. **Commission rates** per service type + walk-in/referral bonus amounts. Pending Legion. Seed
   placeholder defaults in `settings`, mark "confirm rates" in the UI.
3. **Bookkeeper relationship** — does QB sync replace the middleman or feed them? Pending.
4. **Prisma vs Drizzle final sign-off** — proceeding with Drizzle (matches reference code) unless
   Trevor vetoes.

When Cursor hits any of these, it should mark a `// TODO(Q1d): ...` and keep moving — never invent the answer.

---

## MAINTENANCE TIP

Cursor rules are not set-and-forget. **If Cursor makes the same mistake twice, that's a rules
problem, not an AI problem** — add one focused line to `00-project-guardrails.mdc` describing the
mistake and the correct behavior. The rules folder is version-controlled, so the whole team (and
every future session) inherits the fix.
