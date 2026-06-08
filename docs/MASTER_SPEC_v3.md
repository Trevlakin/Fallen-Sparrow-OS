# FALLEN SPARROW — MASTER BUILD SPEC v3.0
## Cursor Handoff Document — Authoritative Source of Truth

**Project:** Fallen Sparrow Tattoo Studio Management System
**Client:** Legion Avegno — Fallen Sparrow Tattoo Co., Kissimmee, FL
**Architect/PM:** Trevor Lakin
**Version:** 3.0 (supersedes v2.0 where conflicts exist)
**Date:** May 28, 2026
**Budget:** $12K–$15K build + $250–$350/mo retainer

---

## HOW TO USE THIS DOCUMENT

This is the **v3.0 reconciliation** of the Fallen Sparrow build. It supersedes `FALLEN_SPARROW_MASTER_SPEC.md` (v2.0) **only where explicitly noted**. Everything in v2.0 not contradicted here remains valid.

**Read order for the implementer (Cursor):**
1. This document (v3.0) — for locked decisions, stack, schema, AI prompts
2. v2.0 master spec — for feature UI details, pain points, business context, testing requirements
3. `B.O.S.S_EXTRACTION_ANALYSIS.md` — for what code to extract/adapt/skip
4. GCOps + B.O.S.S. source zips — reference implementations

**When v2.0 and v3.0 conflict, v3.0 wins.** The major conflicts are stack (Prisma→Drizzle, OpenAI→Anthropic, SendGrid→Resend) and the customer model (segmentation→continuity). All covered below.

---

## SECTION 1: WHAT CHANGED FROM v2.0 (AND WHY)

| # | v2.0 Said | v3.0 Says | Why |
|---|-----------|-----------|-----|
| 1 | ORM: **Prisma** | ORM: **Drizzle** | Both source codebases (GCOps brain dump, B.O.S.S. KPI engine) use Drizzle + TypeScript. Extracting their code is dramatically easier staying in the same ORM. v2.0's own tech-stack note says to flag stack mismatches and unify — this is that flag. **Trevor can override, but the technical case for Drizzle is strong: reusing extracted code with zero ORM translation.** |
| 2 | AI: **OpenAI GPT-4o** | AI: **Anthropic Claude Sonnet 4.6** (`claude-sonnet-4-6`) | GCOps brain dump already runs on the Anthropic SDK — the v2.0 "OpenAI" assumption was wrong about the real code. Consistent provider across the whole build. |
| 3 | Email: **SendGrid** | Email: **Resend** | Team has used Resend before; cleaner DX, reliable transactional delivery for daily briefings. |
| 4 | Language: **JavaScript** (`.js`) | Language: **TypeScript** (`.ts`) | Both source codebases are TypeScript. Type safety across the extracted KPI/financial logic. |
| 5 | File storage: **AWS S3** | File storage: **Cloudflare R2** (S3-compatible) | B.O.S.S. uses R2. S3-compatible API means code is portable; R2 is cheaper for receipt photos. (S3 acceptable if Legion prefers — same SDK.) |
| 6 | Customer Intelligence = **segmentation** (at-risk, referral goldmine, upsell campaigns) | Customer Intelligence = **continuity model** (artist relationships, portfolio flow, friendly nudges) | Legion's explicit decision. Tattoo clients return because they trust the artist and the shop, not because of discount campaigns. See Section 6. |
| 7 | Brain dump = **expense categorizer only** | Brain dump = **full executive assistant** (6 input types) | Expanded scope: one natural-language dump → expenses, incidents, follow-ups, admin tasks, strategic notes, staff notes. See Section 5. |
| 8 | No briefing feature | **AI Briefing** (daily email + on-demand + weekly/monthly) | New paired feature: brain dump is Legion's voice IN, briefing is the system's voice OUT. See Section 7. |
| 9 | Porter = assumed direct integration | Porter = **abstraction layer** with Zapier CSV fallback | Porter has no documented public API. Build behind `PorterIngestionService`; primary path is Zapier→Resend→CSV parse; API is an upgrade path that swaps the source, not the schema. See Section 8. |

**Unchanged from v2.0 (still authoritative):** Express, PostgreSQL, JWT+bcrypt auth, Twilio SMS, Railway hosting, node-cron jobs, Sentry, Winston, the 13 pain points, success criteria, feature UI layouts (mobile + desktop), inventory management, SOP/task library, testing requirements, and code standards.

**Porter is system of record (do not duplicate in-app):** bookings, client messaging, rescheduling, and walk-in logging. We complement Porter via ingestion (`greetedByUserId` on appointments from Porter Q1d), single warm nudges on Customers, and JARVIS `follow_up` tasks — not walk-in log UI, message center, or reschedule workflow.

---

## SECTION 2: LOCKED TECH STACK (v3.0)

| Layer | Technology | Notes |
|---|---|---|
| Language | **TypeScript** | Node 22 server, React 18 client, React Native (Expo) mobile |
| Backend | **Express 5** | Matches both source codebases |
| Database | **PostgreSQL** | Relational + JSONB for flexible config |
| ORM | **Drizzle ORM** | `shared/schema.ts` single schema file |
| Auth | **JWT + bcrypt**, role-based | Roles: OWNER, MANAGER, FRONT_DESK, ARTIST |
| AI | **Anthropic Claude Sonnet 4.6** (`claude-sonnet-4-6`) | Two prompt roles: brain-dump parse + briefing synthesis |
| SMS | **Twilio** | Customer nudges, reschedule reminders |
| Email | **Resend** | Daily briefing delivery + Porter CSV ingestion inbox |
| File Storage | **Cloudflare R2** (S3-compatible SDK) | Receipt photos, report exports |
| Job Scheduling | **node-cron** | Porter sync (daily 6am), briefing (6am), weekly report (Fri 5pm), commission calc, QB retry |
| Hosting | **Railway** | Node + PostgreSQL |
| Frontend Hosting | **Vercel** | Static React build |
| Monitoring | **Sentry** | Error tracking |
| Logging | **Winston** | Structured logs on all API calls + integration events |

### AI Structured Output (Critical Implementation Note)

Anthropic does NOT have OpenAI's `response_format: { type: 'json_object' }`. Use one of:
- **Prompt-for-JSON + parse** (simpler): instruct the model to return only JSON, no preamble/markdown, then `JSON.parse` server-side with validation/coercion (preferred for brain dump — matches GCOps pattern).
- **Tool use** (stricter): define a tool whose input schema is the desired JSON; the model fills it.

Server-side validation is mandatory either way (Zod). Never trust raw model output — coerce types, default missing fields, route low-confidence items to `suggestions[]`.

---

## SECTION 3: DATA MODEL (DRIZZLE SCHEMA)

`shared/schema.ts` — complete schema. Extracted/adapted from B.O.S.S. + new tattoo-native tables. Use `pgTable`, `serial`/`uuid` PKs, `decimal` for money, `jsonb` for config, `timestamp` for dates. Every tenant-scoped table filters on `userId` (or `studioId` for multi-location later).

```typescript
import {
  pgTable, text, varchar, timestamp, jsonb, index, serial,
  integer, decimal, boolean, uuid, pgEnum
} from "drizzle-orm/pg-core";

// ─── ENUMS ───────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["OWNER", "MANAGER", "FRONT_DESK", "ARTIST"]);
export const serviceTypeEnum = pgEnum("service_type", ["tattoo", "piercing", "laser", "other"]);
export const apptStatusEnum = pgEnum("appt_status", ["scheduled", "completed", "cancelled", "no_show"]);
export const referralSourceEnum = pgEnum("referral_source", ["walk_in", "referral_customer", "instagram", "previous", "other"]);
export const taskTypeEnum = pgEnum("task_type", ["expense", "incident", "admin", "follow_up", "staff_note"]);
export const taskStatusEnum = pgEnum("task_status", ["open", "in_progress", "completed"]);
export const taskPriorityEnum = pgEnum("task_priority", ["critical", "high", "normal", "backlog"]);
export const incidentTypeEnum = pgEnum("incident_type", ["equipment_failure", "customer_issue", "staffing", "supply_shortage", "quality_concern", "operational"]);
export const qbSyncStatusEnum = pgEnum("qb_sync_status", ["pending", "synced", "failed", "manual"]);
export const importMethodEnum = pgEnum("import_method", ["zapier_csv", "porter_api", "manual"]);

// ─── USERS & TEAM ────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  role: userRoleEnum("role").default("FRONT_DESK").notNull(),
  phone: varchar("phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Artists: team members who perform paid services. May or may not map 1:1 to a user login.
export const artists = pgTable("artists", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id), // login account, nullable (guest artists)
  porterArtistId: varchar("porter_artist_id").unique(), // stable Porter mapping key
  name: text("name").notNull(),
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 4 }).notNull(), // e.g. 0.5000
  specialties: jsonb("specialties").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  portfolioUrl: text("portfolio_url"),
  bio: text("bio"),
  lastPortfolioUpdate: timestamp("last_portfolio_update"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("artists_porter_idx").on(t.porterArtistId)]);

// ─── CUSTOMERS ───────────────────────────────────────
export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  porterClientId: varchar("porter_client_id").unique(), // stable Porter mapping key
  name: text("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  preferredArtistId: uuid("preferred_artist_id").references(() => artists.id),
  referredByCustomerId: uuid("referred_by_customer_id"), // self-ref, set at creation
  // Calculated/cached fields (recomputed on ingestion)
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default("0"),
  appointmentCount: integer("appointment_count").default(0),
  firstAppointmentDate: timestamp("first_appointment_date"),
  lastAppointmentDate: timestamp("last_appointment_date"),
  typicalGapDays: integer("typical_gap_days"), // median days between appts
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("customers_porter_idx").on(t.porterClientId),
  index("customers_last_appt_idx").on(t.lastAppointmentDate),
]);

// ─── APPOINTMENTS & PAYMENTS ─────────────────────────
export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  porterAppointmentId: varchar("porter_appointment_id").unique(), // idempotency key for ingestion
  customerId: uuid("customer_id").references(() => customers.id),
  artistId: uuid("artist_id").references(() => artists.id),
  serviceType: serviceTypeEnum("service_type").notNull(),
  status: apptStatusEnum("status").notNull().default("scheduled"),
  appointmentDate: timestamp("appointment_date").notNull(),
  completedDate: timestamp("completed_date"),
  depositCollected: boolean("deposit_collected").default(false),
  referralSource: referralSourceEnum("referral_source"),
  greetedByUserId: uuid("greeted_by_user_id").references(() => users.id), // walk-in attribution (front desk)
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (t) => [
  index("appts_porter_idx").on(t.porterAppointmentId),
  index("appts_artist_date_idx").on(t.artistId, t.completedDate),
  index("appts_customer_idx").on(t.customerId),
]);

export const appointmentPayments = pgTable("appointment_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  appointmentId: uuid("appointment_id").references(() => appointments.id).notNull(),
  artistId: uuid("artist_id").references(() => artists.id).notNull(),
  customerId: uuid("customer_id").references(() => customers.id),
  serviceType: serviceTypeEnum("service_type").notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).default("0"),
  finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).default("0"),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0"),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).notNull(),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }), // supplies
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 4 }).notNull(),
  artistPayout: decimal("artist_payout", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: varchar("payment_method", { length: 20 }), // cash | card | other
  paymentDate: timestamp("payment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("pay_artist_date_idx").on(t.artistId, t.paymentDate),
  index("pay_service_idx").on(t.serviceType),
]);

// ─── COMMISSIONS (calculated payout periods) ─────────
export const commissions = pgTable("commissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  artistId: uuid("artist_id").references(() => artists.id).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  serviceRevenue: decimal("service_revenue", { precision: 12, scale: 2 }).notNull(),
  commissionEarned: decimal("commission_earned", { precision: 12, scale: 2 }).notNull(),
  walkInBonus: decimal("walk_in_bonus", { precision: 10, scale: 2 }).default("0"),
  referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default("0"),
  totalOwed: decimal("total_owed", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
  scheduledPayoutDate: timestamp("scheduled_payout_date"),
  status: varchar("status", { length: 20 }).default("pending"), // pending | paid
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("comm_artist_period_idx").on(t.artistId, t.periodStart)]);

// ─── BRAIN DUMP OUTPUTS ──────────────────────────────
export const expenses = pgTable("expenses", {
  id: uuid("id").primaryKey().defaultRandom(),
  loggedByUserId: uuid("logged_by_user_id").references(() => users.id),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(), // see EXPENSE_CATEGORIES constant
  qbGlAccount: varchar("qb_gl_account", { length: 20 }),
  qbSyncStatus: qbSyncStatusEnum("qb_sync_status").default("pending"),
  receiptUrl: text("receipt_url"), // R2 path
  inventorySku: varchar("inventory_sku", { length: 50 }),
  inventoryQty: integer("inventory_qty"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  needsReview: boolean("needs_review").default(false),
  expenseDate: timestamp("expense_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  loggedByUserId: uuid("logged_by_user_id").references(() => users.id),
  incidentType: incidentTypeEnum("incident_type").notNull(),
  description: text("description").notNull(),
  priority: taskPriorityEnum("priority").default("normal"),
  status: taskStatusEnum("status").default("open"),
  resolution: text("resolution"),
  resolvedDate: timestamp("resolved_date"),
  occurredDate: timestamp("occurred_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strategicNotes = pgTable("strategic_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorUserId: uuid("author_user_id").references(() => users.id),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("notes_created_idx").on(t.createdAt)]);
// NOTE: add a Postgres full-text index (tsvector) on content for the global search bar.

export const taskQueue = pgTable("task_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: taskTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  linkedRecordId: uuid("linked_record_id"), // FK to expense/incident/customer (polymorphic)
  linkedRecordType: varchar("linked_record_type", { length: 30 }),
  status: taskStatusEnum("status").default("open"),
  priority: taskPriorityEnum("priority").default("normal"),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Low-confidence brain-dump items awaiting manual promotion
export const suggestions = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  brainDumpId: uuid("brain_dump_id"),
  proposedType: taskTypeEnum("proposed_type").notNull(),
  rawText: text("raw_text").notNull(),
  parsedPayload: jsonb("parsed_payload"), // the partial structured object
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pending"), // pending | promoted | dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

export const brainDumps = pgTable("brain_dumps", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorUserId: uuid("author_user_id").references(() => users.id),
  rawInput: text("raw_input").notNull(),
  inputType: varchar("input_type", { length: 10 }).default("text"), // text | voice
  receiptUrls: jsonb("receipt_urls").$type<string[]>().default([]),
  parseResult: jsonb("parse_result"), // full AI output for audit
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── BRIEFINGS ───────────────────────────────────────
export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefingType: varchar("briefing_type", { length: 10 }).notNull(), // daily | weekly | monthly | on_demand
  generatedAt: timestamp("generated_at").defaultNow(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  dataSnapshot: jsonb("data_snapshot"), // the aggregated inputs
  narrative: text("narrative"), // the AI-written prose
  deliveredVia: varchar("delivered_via", { length: 20 }), // email | dashboard
  deliveredAt: timestamp("delivered_at"),
});

// ─── NUDGES (friendly reconnect) ─────────────────────
export const nudges = pgTable("nudges", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").references(() => customers.id).notNull(),
  reason: varchar("reason", { length: 30 }).default("friendly_reconnect"),
  message: text("message"),
  channel: varchar("channel", { length: 10 }), // sms | email
  sentAt: timestamp("sent_at"),
  resonated: boolean("resonated"), // did they book after? set later
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [index("nudges_customer_idx").on(t.customerId)]);

// ─── INVENTORY (from v2.0, kept) ─────────────────────
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sku: varchar("sku", { length: 50 }).unique().notNull(),
  name: text("name").notNull(),
  category: varchar("category", { length: 30 }),
  currentQty: integer("current_qty").default(0),
  reorderThreshold: integer("reorder_threshold").default(0),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id").references(() => inventoryItems.id).notNull(),
  delta: integer("delta").notNull(), // + for restock, - for usage
  reason: varchar("reason", { length: 50 }), // expense_import | service_use | manual
  linkedExpenseId: uuid("linked_expense_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SOP / TASKS (from v2.0, kept) ───────────────────
export const sops = pgTable("sops", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  role: userRoleEnum("role"), // who it applies to
  frequency: varchar("frequency", { length: 20 }), // daily | weekly | monthly
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sopChecklistItems = pgTable("sop_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sopId: uuid("sop_id").references(() => sops.id).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
});

// ─── QB SYNC QUEUE (retry; not in B.O.S.S., needed here) ──
export const qbSyncQueue = pgTable("qb_sync_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  expenseId: uuid("expense_id").references(() => expenses.id),
  payload: jsonb("payload").notNull(),
  attempts: integer("attempts").default(0),
  lastError: text("last_error"),
  status: qbSyncStatusEnum("status").default("pending"),
  nextRetryAt: timestamp("next_retry_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SETTINGS & META ─────────────────────────────────
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
// Holds: commission rates, expense category→GL map, nudge thresholds,
// briefing prefs, business hours, walk-in/referral bonus amounts.

export const porterImportLog = pgTable("porter_import_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  importDate: timestamp("import_date").defaultNow(),
  recordCount: integer("record_count").default(0),
  sourceMethod: importMethodEnum("source_method").notNull(),
  status: varchar("status", { length: 20 }).default("success"), // success | partial | failed
  errors: jsonb("errors").$type<string[]>().default([]),
});

export const meta = pgTable("meta", {
  id: serial("id").primaryKey(),
  lastPorterImport: timestamp("last_porter_import"),
  lastBriefingSent: timestamp("last_briefing_sent"),
  lastQbSync: timestamp("last_qb_sync"),
  updatedAt: timestamp("updated_at").defaultNow(),
});
```

**DO NOT PORT from B.O.S.S.:** `businessGoals`, `userActivity`, `monthlyAchievementLimits`, `userFingerprints`, `globalAchievementLimits`, `setupCompletion` — these are B2B gamification/anti-fraud tables irrelevant to a tattoo shop.

---

## SECTION 4: CONSTANTS FILE (SINGLE SOURCE OF TRUTH)

`shared/constants.ts` — the one place expense categories live. Every coupling point derives from here: the Claude prompt text, the runtime validation, and the QB GL mapping. **Never hardcode a category string anywhere else.**

```typescript
export const EXPENSE_CATEGORIES = {
  SUPPLIES:    { name: "Supplies",    qbAccount: "6100_Supplies_Expense",      description: "ink, needles, gloves, cleaning supplies, sterilization packs, any consumable used in services" },
  MAINTENANCE: { name: "Maintenance", qbAccount: "6200_Repairs_Maintenance",   description: "repairs, fixes, anything that maintains the physical space or equipment" },
  PAYROLL:     { name: "Payroll",     qbAccount: "6300_Payroll_Expense",       description: "wages, contractor payments, artist fees — anything paid to a person for work" },
  MARKETING:   { name: "Marketing",   qbAccount: "6500_Marketing_Advertising", description: "advertising, social media, promotional materials, photography" },
  UTILITIES:   { name: "Utilities",   qbAccount: "6600_Utilities",             description: "electricity, water, internet, phone, monthly building services" },
  ADMIN:       { name: "Admin",       qbAccount: "6700_Admin_General",         description: "office supplies, software subscriptions, accounting fees, licenses, permits" },
  FURNITURE:   { name: "Furniture",   qbAccount: "1500_Furniture_Equipment",   description: "chairs, desks, lobby furniture, equipment — one-time purchases (asset account)" },
} as const;

export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES;

// The prompt's category block is GENERATED from this object — see Section 5.
export const EXPENSE_CATEGORY_PROMPT_BLOCK = Object.values(EXPENSE_CATEGORIES)
  .map(c => `- ${c.name} (${c.description})`)
  .join("\n");

export const CONFIDENCE_THRESHOLD = 0.85; // commit at/above; suggestions[] below — applies to ALL brain-dump item types

export const NUDGE_RULES = {
  overdueBufferDays: 30,         // only nudge if > typicalGap + 30 days
  maxGapMultiplier: 3,           // don't nudge if > typicalGap * 3 (too cold)
  minDaysBetweenNudges: 30,      // never nudge same customer more than 1x/month
};
```

Commission rates, walk-in/referral bonus amounts, and nudge thresholds live in the `settings` table (owner-configurable), seeded from defaults. **Default commission rates are PENDING Legion's confirmation** — see Open Items.

---

## SECTION 5: BRAIN DUMP — EXECUTIVE ASSISTANT (v3.0 EXPANDED)

**Supersedes v2.0 §5.1.2.** One natural-language dump (text or voice, optional receipt photos) parses into multiple structured records. This is Legion's voice IN.

### 5.1 Input Types → Outputs

| Input the user mentions | Routed to | Table |
|---|---|---|
| A purchase / money spent | Expense → QB GL + inventory increment | `expenses` |
| Something broke / operational issue | Incident (post-hoc log, no assignment) | `incidents` |
| A customer to follow up with | Follow-up task | `taskQueue` (type=follow_up) |
| An idea / strategic thought | Strategic note (searchable) | `strategicNotes` |
| A staff observation | Staff note (visible to briefing) | `taskQueue` (type=staff_note) |
| Paperwork / admin to-do | Admin task | `taskQueue` (type=admin) |

### 5.2 Grounding Philosophy (Highest-Priority Rule — from GCOps)

> **Never invent data. If a field isn't clearly stated, leave it empty or route the whole item to `suggestions[]`. Prefer empty arrays over guessing. Uncertain items (confidence < 0.85) are NOT committed — they go to the suggestions queue for manual promotion.**

### 5.3 Brain Dump Parse Prompt (Anthropic — word-for-word)

```
System:
You are the operations assistant for Fallen Sparrow, a tattoo studio. You convert a
shop owner's quick brain dump into structured records. You extract ONLY what is clearly
stated. You never invent amounts, dates, names, or categories. If something is ambiguous,
you lower your confidence and let a human confirm it.

Today is {{TODAY_ISO}} ({{TODAY_WEEKDAY}}). Use this to resolve relative dates like
"yesterday" or "last Tuesday". Never compute a date yourself beyond this reference table:
{{DATE_REFERENCE_TABLE}}

Expense categories (choose exactly one per expense):
{{EXPENSE_CATEGORY_PROMPT_BLOCK}}

Incident types: equipment_failure, customer_issue, staffing, supply_shortage,
quality_concern, operational.

Return ONLY a JSON object — no preamble, no markdown fences, no explanation. Shape:
{
  "expenses": [
    { "description": string, "amount": number, "category": "<exact category name>",
      "expenseDate": "<ISO date>", "inventorySku": string|null,
      "inventoryQty": integer|null, "confidence": 0.0-1.0 }
  ],
  "incidents": [
    { "incidentType": "<type>", "description": string, "priority": "critical|high|normal|backlog",
      "occurredDate": "<ISO date>|null", "resolution": string|null,
      "resolvedDate": "<ISO date>|null", "confidence": 0.0-1.0 }
  ],
  "followUps": [
    { "title": string, "customerName": string|null, "dueDate": "<ISO date>|null",
      "confidence": 0.0-1.0 }
  ],
  "adminTasks": [
    { "title": string, "description": string|null, "dueDate": "<ISO date>|null",
      "confidence": 0.0-1.0 }
  ],
  "strategicNotes": [
    { "content": string, "tags": string[], "confidence": 0.0-1.0 }
  ],
  "staffNotes": [
    { "content": string, "confidence": 0.0-1.0 }
  ]
}

Rules:
- An item that doesn't fit any bucket → put it in strategicNotes with low confidence.
- An expense without a clear amount → do NOT put it in expenses; put a staffNote describing it.
- Incidents are records of things that happened. Do not assign them to anyone.
- Empty buckets are empty arrays, never omitted.

User:
{{RAW_BRAIN_DUMP_TEXT}}
```

### 5.4 Receipt Vision OCR (separate call, when photos attached — adapted from GCOps)

A vision call extracts `{ vendor, total, date, lineItems[] }` from each receipt photo, then those are merged into the expense candidates (greedy 1:1 match — tattoo receipts are usually single-purchase). Use `claude-sonnet-4-6` with the image block. Same JSON-only discipline.

### 5.5 Server-Side Processing

1. Persist raw dump to `brainDumps`.
2. Call parse prompt → `JSON.parse` → Zod-validate/coerce.
3. For each item: `confidence >= 0.85` → write to its table; else → `suggestions[]`.
4. Expenses also: map category→`qbGlAccount` via constants, enqueue QB sync, increment inventory if `inventorySku` present.
5. Return per-item feedback to UI (matches v2.0 success/warning/failure toasts).

---

## SECTION 6: CUSTOMER CONTINUITY MODEL (v3.0 — REPLACES v2.0 §5.2.5)

**Legion's decision: no segmentation, no manufactured re-engagement campaigns, no discount-driven referral incentives.** Tattoo clients return because they trust the artist and the shop. Build relationship/portfolio intelligence, not a sales funnel.

### 6.1 Artist Performance (NEW)

Per artist, per period: total revenue, commission earned, shop margin, appointment count, completed/cancelled/no-show, avg booking value, revenue/day, **repeat-customer rate**, customers served, booking utilization, portfolio freshness. Surfaces "which artist is carrying the studio," "who's underbooked," "whose portfolio needs a refresh."

### 6.2 Customer Continuity (NEW)

Per customer: full tattoo history (date, artist, body part, style, notes), preferred artist, list of artists worked with, first/last appointment, **typical gap** (median days between appointments), and an **isOverdue** flag = `daysSinceLast > typicalGap × 1.3`. Powers portfolio continuity ("Jane is building a back piece — Carlos should see how the next one connects").

### 6.3 Friendly Nudges (NEW — replaces "at-risk outreach")

A nudge fires only when a customer is genuinely due for their next piece: `daysSinceLast > typicalGap + 30` AND `< typicalGap × 3` AND not nudged in the last 30 days. The message is a warm "we'd love to see you / [artist] misses your work" — **never a discount**. Logged in `nudges`; `resonated` is set true if they book afterward (feeds future tuning).

### 6.4 Natural Referral Tracking (NEW)

Build the referral graph from `appointments.referredByCustomerId`. Identify who organically brings business. Action is recognition (priority booking, a thank-you, a featured-client portfolio spot) — **not** "$50 for a friend" campaigns. Top referrers surface in the weekly briefing.

---

## SECTION 7: AI BRIEFING (NEW — the system's voice OUT)

### 7.1 Cadence & Delivery (LOCKED)

- **Daily** — 6am, automated, emailed via Resend to Legion.
- **On-demand** — button in mobile + dashboard, pulls a fresh snapshot anytime.
- **Weekly** — Friday 5pm synthesis (trends, artist performance, top referrers).
- **Monthly** — 1st of month, strategic (margins by service, artist economics, cash after payroll).

### 7.2 Data Sources

Brain dump outputs (expenses, incidents, notes) + Porter financial snapshot (revenue by artist/service, commissions due, inventory) + continuity model (nudge candidates, referrers, portfolio gaps). Aggregated into a `dataSnapshot`, then synthesized.

### 7.3 Briefing Synthesis Prompt (Anthropic — word-for-word)

```
System:
You are the studio's morning briefing writer for Fallen Sparrow tattoo studio. You turn a
JSON snapshot of yesterday's (or the period's) numbers and flags into a short, warm, plain-spoken
briefing for the owner, Legion. Write in natural prose — NOT bullet lists, NOT corporate jargon.
Lead with the most important thing. Be specific with names and dollar figures from the data.
Never invent numbers that aren't in the snapshot. If a section has no data, skip it silently.
Keep it to 4-8 sentences for a daily briefing, longer for weekly/monthly. End with at most one
clear suggested action if the data warrants it.

Period: {{BRIEFING_TYPE}} — {{PERIOD_START}} to {{PERIOD_END}}

User:
{{DATA_SNAPSHOT_JSON}}
```

The narrative + snapshot are stored in `briefings`. Email body = narrative; dashboard renders both narrative and a structured card.

---

## SECTION 8: PORTER INGESTION (ABSTRACTION LAYER)

**Porter has no documented public API.** Build everything behind `PorterIngestionService` so the rest of the system only ever consumes the normalized schema in Section 3.

### 8.1 Primary Path — Zapier CSV via Resend Inbound

```
Porter dashboard export (daily)
  → Zapier emails the CSV to an inbound Resend address
  → Resend inbound webhook → PorterIngestionService.ingestCsvEmail()
     1. Parse CSV attachment (csv-parse)
     2. Normalize → NormalizedPorterAppointment[]
     3. Upsert by porterAppointmentId (idempotent)
     4. Recompute customer cached fields (totalSpent, counts, typicalGap)
     5. Create/update appointmentPayments (compute artistPayout from commission rate)
     6. Log to porterImportLog
     7. Fire daily metrics recompute + briefing synthesis
```

### 8.2 Upgrade Path — Porter API

If Porter exposes an API later, implement `ingestViaApi()` that produces the **identical** `NormalizedPorterAppointment[]`. Nothing downstream changes. Source method recorded as `porter_api` in the log.

### 8.3 Normalized Type

```typescript
interface NormalizedPorterAppointment {
  porterAppointmentId: string;     // idempotency key
  porterClientId: string;
  clientName: string;
  porterArtistId: string;
  artistName: string;
  serviceType: "tattoo" | "piercing" | "laser" | "other";
  depositAmount: number;
  finalAmount: number;
  tipAmount: number;
  totalRevenue: number;
  appointmentDate: string;  // ISO
  completedDate: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  paymentMethod?: string;
  notes?: string;
  walkInGreetedBy?: string | null; // front-desk attribution, if Porter provides it
}
```

### 8.4 Mapping Resolution

Resolve `porterArtistId`→`artists.id` and `porterClientId`→`customers.id` on ingestion; create the customer if new. Field names in Porter's CSV are **unknown until Q1d is answered** — keep the CSV→normalized mapping in a single `mapPorterRow()` function so the column names are changeable in one place.

---

## SECTION 9: COMMISSION ENGINE

**Keep v2.0 §5.2.4's structure; drive it from Porter payment data.** Per artist: sum `appointmentPayments.artistPayout` over the pay period → `commissions` row. Walk-in bonus (flat, to `appointments.greetedByUserId`) and referral bonus remain **configurable in settings but optional** — Legion can set them to $0. Rates per service type live in settings.

⚠️ **Commission depends on Porter giving per-artist, per-service revenue.** Confirmed Porter calculates commission splits internally and reports "sales by artist" — but whether we can extract appointment-level detail (vs. dashboard-only) is the open Q1d item. If only aggregate totals are available, the engine falls back to period totals per artist without per-appointment granularity.

---

## SECTION 10: B.O.S.S. EXTRACTION MAP

See `B.O.S.S_EXTRACTION_ANALYSIS.md` for full detail. Summary:

**Extract + adapt:** `server/routes/metrics.ts` (daily/weekly/monthly aggregation), `server/routes/payroll.ts` (→ commission calc), `server/lib/profit.ts` (margin logic), `server/repos/revenueRepo.ts` (financial queries), `server/middleware/tenantEnforcement.ts`, `server/db.ts`, `server/auth.ts`, `shared/schema.ts` (as the Drizzle starting point).

**Skip:** `outreach.ts`, `coaching.ts`, `services/mission.ts`, `services/smartMixV2.ts`, `lib/hormozi.ts`, `lib/cycles.ts`, all achievement/fingerprint tables.

**Build new:** `services/artistAnalytics.ts`, `services/customerContinuity.ts`, `services/communityNudges.ts`, `services/referralTracking.ts`, `services/briefingSynthesis.ts`, `integrations/porterIngestion.ts`.

---

## SECTION 11: BUILD ROADMAP (8 SPRINTS / ~8 WEEKS)

| Sprint | Deliverable | Acceptance Criteria |
|---|---|---|
| **1** | DB schema + migrations + auth + tenant middleware | Drizzle schema migrates clean; JWT login works for all 4 roles; seed script loads artists + settings defaults |
| **2** | Porter ingestion (Zapier CSV path) | Sample CSV → normalized rows → appointments + payments upserted idempotently; re-import causes no duplicates; import logged |
| **3** | Metrics API (daily/weekly/monthly by artist + service) | Endpoints return revenue, count, margin by artist and service; matches hand-calculated totals on test data |
| **4** | Brain dump parse + storage + suggestions queue | Multi-type dump parses correctly; ≥0.85 commits, <0.85 → suggestions; receipt OCR populates expense; QB sync enqueued |
| **5** | Commission engine + Financial dashboard (P&L) | Commissions computed per artist/period; P&L shows revenue − COGS − payroll − fixed = net; margins per service correct |
| **6** | Artist analytics + customer continuity + referral graph | Repeat rate, utilization, typicalGap computed; nudge candidates identified per rules; referral graph built |
| **7** | Briefing synthesis + Resend email + nudge sending (Twilio/Resend) | 6am daily email delivers narrative; on-demand pull works; weekly/monthly cadence; nudges respect frequency cap |
| **8** | Mobile views + dashboard views (React) + testing | Mobile: briefing card, JARVIS. Desktop: P&L, inventory, SOP/tasks, commissions, continuity, settings. Unit + integration tests pass; pre-delivery checklist (v2.0 §10.3) green |

**Inventory, SOP/task library, settings/roles, weekly report:** build per v2.0 §5 UI specs where still in scope. **Out of scope (Porter):** walk-in logging UI, message center, reschedule tracking.

---

## SECTION 12: OPEN ITEMS (NON-BLOCKING)

| Item | Owner | Impact | Default if unanswered |
|---|---|---|---|
| **Q1d** Porter API / QB integration / appointment-level export / walk-in attribution field | Legion (awaiting Porter) | Real-time vs. daily; auto vs. manual QB; commission granularity | Zapier CSV daily; manual QB via our own sync; aggregate commission fallback |
| **Commission rates** per service type + walk-in/referral bonus amounts | Legion | Seeds `settings` defaults | Use placeholder rates (tattoo 50/50 split etc.); flag clearly in UI as "confirm rates" |
| **Bookkeeper relationship** — does QB sync replace the middleman or feed them? | Legion / Trevor | QB integration scope | Build QB sync; bookkeeper consumes QB as before |
| **Prisma vs Drizzle** final sign-off | Trevor | ORM choice | Proceed with Drizzle (matches source code) unless vetoed |

None block Sprint 1. Resolve Q1d before Sprint 2 ships to production, but development proceeds on the Zapier path regardless.

---

## SECTION 13: WHAT STAYS FROM v2.0 (DO NOT REBUILD)

Pull these directly from `FALLEN_SPARROW_MASTER_SPEC.md` — unchanged by v3.0:
- §1 Job definition, §2 business context + 13 pain points + success criteria
- §5.1.3 mobile dashboard, §5.1.4 task checklist
- §5.2.1 P&L dashboard layout, §5.2.2 inventory, §5.2.3 SOP/task library, §5.2.8 weekly report, §5.2.9 settings/roles
- **Skip (Porter owns):** §5.1.5 walk-in logging, §5.2.6 message center, §5.2.7 reschedule tracking
- §6 pain-point verification, §9 code standards, §10 testing requirements

**Override in v2.0:** §4.2 stack (use §2 here), §5.1.2 brain dump (use §5 here), §5.2.5 customer intelligence (use §6 here), §7.3 OpenAI (use Anthropic), §7.5 SendGrid (use Resend), §8 Prisma schema (use §3 Drizzle here).

---

## CONCLUSION

This v3.0 spec reconciles the build with what the source code actually is (TypeScript + Drizzle + Anthropic) and what Legion actually wants (continuity over segmentation, an executive-assistant brain dump, a daily briefing). It is ready to drop into Cursor as the authoritative reference alongside the v2.0 detail spec and the two source zips.

**Build with confidence. The architecture is locked.**
