/**
 * MASTER_SPEC_v3 §3: Drizzle schema (single source of truth).
 */
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  uuid,
  pgEnum,
  date,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ─── ENUMS ───────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "OWNER",
  "MANAGER",
  "FRONT_DESK",
  "ARTIST",
]);
export const serviceTypeEnum = pgEnum("service_type", [
  "tattoo",
  "piercing",
  "laser",
  "other",
]);
export const apptStatusEnum = pgEnum("appt_status", [
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);
export const referralSourceEnum = pgEnum("referral_source", [
  "walk_in",
  "referral_customer",
  "instagram",
  "previous",
  "other",
]);
export const taskTypeEnum = pgEnum("task_type", [
  "expense",
  "incident",
  "admin",
  "follow_up",
  "staff_note",
]);
export const taskStatusEnum = pgEnum("task_status", [
  "open",
  "in_progress",
  "completed",
]);
export const taskPriorityEnum = pgEnum("task_priority", [
  "critical",
  "high",
  "normal",
  "backlog",
]);
export const incidentTypeEnum = pgEnum("incident_type", [
  "equipment_failure",
  "customer_issue",
  "staffing",
  "supply_shortage",
  "quality_concern",
  "operational",
]);
export const qbSyncStatusEnum = pgEnum("qb_sync_status", [
  "pending",
  "synced",
  "failed",
  "manual",
]);
export const importMethodEnum = pgEnum("import_method", [
  "zapier_csv",
  "porter_api",
  "manual",
]);

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

export const artists = pgTable(
  "artists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    porterArtistId: varchar("porter_artist_id").unique(),
    name: text("name").notNull(),
    commissionPercentage: decimal("commission_percentage", {
      precision: 5,
      scale: 4,
    }).notNull(),
    specialties: jsonb("specialties").$type<string[]>().default([]),
    isActive: boolean("is_active").default(true),
    portfolioUrl: text("portfolio_url"),
    bio: text("bio"),
    lastPortfolioUpdate: timestamp("last_portfolio_update"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("artists_porter_idx").on(t.porterArtistId)],
);

// ─── CUSTOMERS ───────────────────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    porterClientId: varchar("porter_client_id").unique(),
    name: text("name").notNull(),
    email: varchar("email"),
    phone: varchar("phone"),
    preferredArtistId: uuid("preferred_artist_id").references(() => artists.id),
    referredByCustomerId: uuid("referred_by_customer_id"),
    totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).default(
      "0",
    ),
    appointmentCount: integer("appointment_count").default(0),
    firstAppointmentDate: timestamp("first_appointment_date"),
    lastAppointmentDate: timestamp("last_appointment_date"),
    typicalGapDays: integer("typical_gap_days"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("customers_porter_idx").on(t.porterClientId),
    index("customers_last_appt_idx").on(t.lastAppointmentDate),
  ],
);

// ─── APPOINTMENTS & PAYMENTS ─────────────────────────
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    porterAppointmentId: varchar("porter_appointment_id").unique(),
    customerId: uuid("customer_id").references(() => customers.id),
    artistId: uuid("artist_id").references(() => artists.id),
    serviceType: serviceTypeEnum("service_type").notNull(),
    status: apptStatusEnum("status").notNull().default("scheduled"),
    appointmentDate: timestamp("appointment_date").notNull(),
    completedDate: timestamp("completed_date"),
    depositCollected: boolean("deposit_collected").default(false),
    referralSource: referralSourceEnum("referral_source"),
    greetedByUserId: uuid("greeted_by_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("appts_porter_idx").on(t.porterAppointmentId),
    index("appts_artist_date_idx").on(t.artistId, t.completedDate),
    index("appts_customer_idx").on(t.customerId),
  ],
);

export const appointmentPayments = pgTable(
  "appointment_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appointmentId: uuid("appointment_id")
      .references(() => appointments.id)
      .notNull(),
    artistId: uuid("artist_id")
      .references(() => artists.id)
      .notNull(),
    customerId: uuid("customer_id").references(() => customers.id),
    serviceType: serviceTypeEnum("service_type").notNull(),
    depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).default(
      "0",
    ),
    finalAmount: decimal("final_amount", { precision: 10, scale: 2 }).default(
      "0",
    ),
    tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0"),
    totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).notNull(),
    estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
    actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
    commissionPercentage: decimal("commission_percentage", {
      precision: 5,
      scale: 4,
    }).notNull(),
    artistPayout: decimal("artist_payout", { precision: 10, scale: 2 }).notNull(),
    artistPaidAt: timestamp("artist_paid_at"),
    artistPayoutMethod: varchar("artist_payout_method", { length: 20 }),
    paymentMethod: varchar("payment_method", { length: 20 }),
    paymentDate: timestamp("payment_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [
    index("pay_artist_date_idx").on(t.artistId, t.paymentDate),
    index("pay_service_idx").on(t.serviceType),
  ],
);

// ─── COMMISSIONS ─────────────────────────────────────
export const commissions = pgTable(
  "commissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .references(() => artists.id)
      .notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),
    serviceRevenue: decimal("service_revenue", {
      precision: 12,
      scale: 2,
    }).notNull(),
    commissionEarned: decimal("commission_earned", {
      precision: 12,
      scale: 2,
    }).notNull(),
    walkInBonus: decimal("walk_in_bonus", { precision: 10, scale: 2 }).default(
      "0",
    ),
    referralBonus: decimal("referral_bonus", { precision: 10, scale: 2 }).default(
      "0",
    ),
    totalOwed: decimal("total_owed", { precision: 12, scale: 2 }).notNull(),
    paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).default("0"),
    scheduledPayoutDate: timestamp("scheduled_payout_date"),
    status: varchar("status", { length: 20 }).default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("comm_artist_period_idx").on(t.artistId, t.periodStart)],
);

// ─── BRAIN DUMP OUTPUTS ──────────────────────────────
export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loggedByUserId: uuid("logged_by_user_id").references(() => users.id),
    description: text("description").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    category: varchar("category", { length: 30 }).notNull(),
    qbGlAccount: varchar("qb_gl_account", { length: 50 }),
    qbSyncStatus: qbSyncStatusEnum("qb_sync_status").default("pending"),
    quickbooksId: varchar("quickbooks_id", { length: 50 }),
    source: varchar("source", { length: 20 }).default("manual"),
    receiptUrl: text("receipt_url"),
    inventorySku: varchar("inventory_sku", { length: 50 }),
    inventoryQty: integer("inventory_qty"),
    aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
    needsReview: boolean("needs_review").default(false),
    expenseDate: timestamp("expense_date").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    uniqueIndex("expenses_quickbooks_id_idx").on(t.quickbooksId),
    index("expenses_source_idx").on(t.source),
  ],
);

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
  linkedExpenseId: uuid("linked_expense_id"),
  linkedExpenseAmount: integer("linked_expense_amount"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const strategicNotes = pgTable(
  "strategic_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorUserId: uuid("author_user_id").references(() => users.id),
    content: text("content").notNull(),
    tags: jsonb("tags").$type<string[]>().default([]),
    aiExpansion: text("ai_expansion"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("notes_created_idx").on(t.createdAt)],
);

export const taskQueue = pgTable("task_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: taskTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  linkedRecordId: uuid("linked_record_id"),
  linkedRecordType: varchar("linked_record_type", { length: 30 }),
  status: taskStatusEnum("status").default("open"),
  priority: taskPriorityEnum("priority").default("normal"),
  dueDate: timestamp("due_date"),
  completedDate: timestamp("completed_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const suggestions = pgTable("suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  brainDumpId: uuid("brain_dump_id"),
  proposedType: taskTypeEnum("proposed_type").notNull(),
  rawText: text("raw_text").notNull(),
  parsedPayload: jsonb("parsed_payload"),
  aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const brainDumps = pgTable("brain_dumps", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorUserId: uuid("author_user_id").references(() => users.id),
  rawInput: text("raw_input").notNull(),
  inputType: varchar("input_type", { length: 10 }).default("text"),
  receiptUrls: jsonb("receipt_urls").$type<string[]>().default([]),
  parseResult: jsonb("parse_result"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jarvisRequests = pgTable(
  "jarvis_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    authorUserId: uuid("author_user_id")
      .references(() => users.id)
      .notNull(),
    rawInput: text("raw_input").notNull(),
    intent: varchar("intent", { length: 10 }).notNull(),
    inputType: varchar("input_type", { length: 10 }).default("text").notNull(),
    responsePreview: text("response_preview"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("jarvis_requests_author_created_idx").on(t.authorUserId, t.createdAt),
  ],
);

export const pnlImportHistory = pgTable(
  "pnl_import_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importType: varchar("import_type", { length: 20 }).notNull(),
    fileName: text("file_name").notNull(),
    rowCount: integer("row_count").notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    importedByUserId: uuid("imported_by_user_id")
      .references(() => users.id)
      .notNull(),
    summaryStats: jsonb("summary_stats").$type<{
      errorCount?: number;
    }>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("pnl_import_history_created_idx").on(t.createdAt)],
);

// ─── BRIEFINGS ───────────────────────────────────────
export const briefings = pgTable("briefings", {
  id: uuid("id").primaryKey().defaultRandom(),
  briefingType: varchar("briefing_type", { length: 10 }).notNull(),
  generatedAt: timestamp("generated_at").defaultNow(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  dataSnapshot: jsonb("data_snapshot"),
  narrative: text("narrative"),
  deliveredVia: varchar("delivered_via", { length: 20 }),
  deliveredAt: timestamp("delivered_at"),
});

// ─── NUDGES ──────────────────────────────────────────
export const nudges = pgTable(
  "nudges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    reason: varchar("reason", { length: 30 }).default("friendly_reconnect"),
    message: text("message"),
    channel: varchar("channel", { length: 10 }),
    sentAt: timestamp("sent_at"),
    resonated: boolean("resonated"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("nudges_customer_idx").on(t.customerId)],
);

// ─── INVENTORY (Sprint 8K) ───────────────────────────
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 30 }).notNull(),
  unit: varchar("unit", { length: 50 }).notNull(),
  currentStock: integer("current_stock").default(0),
  reorderThreshold: integer("reorder_threshold"),
  idealStock: integer("ideal_stock"),
  notes: varchar("notes", { length: 500 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const inventoryTransactions = pgTable("inventory_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id")
    .references(() => inventoryItems.id)
    .notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  notes: varchar("notes", { length: 500 }),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── SOP / TASKS (Sprint 8L) ─────────────────────────
export const teamMembers = pgTable("team_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(),
  pin: varchar("pin", { length: 255 }).notNull(),
  /** Manager-only display copy; updated whenever a PIN is set or changed. */
  pinPlaintext: varchar("pin_plaintext", { length: 4 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const pinChangeHistory = pgTable(
  "pin_change_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamMemberId: uuid("team_member_id")
      .references(() => teamMembers.id, { onDelete: "cascade" })
      .notNull(),
    changedByUserId: uuid("changed_by_user_id")
      .references(() => users.id)
      .notNull(),
    changedAt: timestamp("changed_at").defaultNow().notNull(),
    changeReason: varchar("change_reason", { length: 200 }),
  },
  (t) => [
    index("pin_change_history_member_idx").on(t.teamMemberId),
    index("pin_change_history_changed_at_idx").on(t.changedAt),
  ],
);

export const sops = pgTable("sops", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  role: userRoleEnum("role"),
  frequency: varchar("frequency", { length: 20 }),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sopRoleAssignments = pgTable(
  "sop_role_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sopId: uuid("sop_id")
      .references(() => sops.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 50 }).notNull(),
  },
  (t) => [
    uniqueIndex("sop_role_assignments_sop_role_unique").on(t.sopId, t.role),
  ],
);

export const sopChecklistItems = pgTable("sop_checklist_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  sopId: uuid("sop_id")
    .references(() => sops.id, { onDelete: "cascade" })
    .notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sopCompletions = pgTable(
  "sop_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .references(() => sopChecklistItems.id, { onDelete: "cascade" })
      .notNull(),
    teamMemberId: uuid("team_member_id").references(() => teamMembers.id, {
      onDelete: "cascade",
    }),
    completedByUserId: uuid("completed_by_user_id").references(() => users.id),
    completedByLabel: varchar("completed_by_label"),
    completedAt: timestamp("completed_at").defaultNow(),
    sessionDate: date("session_date").notNull(),
  },
  (t) => [
    index("sop_completions_item_session_idx").on(t.itemId, t.sessionDate),
    index("sop_completions_session_date_idx").on(t.sessionDate),
    index("sop_completions_member_session_idx").on(
      t.teamMemberId,
      t.sessionDate,
    ),
    uniqueIndex("sop_completions_item_member_session_unique")
      .on(t.itemId, t.teamMemberId, t.sessionDate)
      .where(sql`${t.teamMemberId} IS NOT NULL`),
    uniqueIndex("sop_completions_item_session_legacy_unique")
      .on(t.itemId, t.sessionDate)
      .where(sql`${t.teamMemberId} IS NULL`),
  ],
);

export const extraTasks = pgTable(
  "extra_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    description: text("description").notNull(),
    teamMemberId: uuid("team_member_id").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    loggedByLabel: varchar("logged_by_label", { length: 100 }),
    status: varchar("status", { length: 20 }).default("open").notNull(),
    loggedAt: timestamp("logged_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    sessionDate: date("session_date").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("extra_tasks_session_date_idx").on(t.sessionDate),
    index("extra_tasks_status_idx").on(t.status),
  ],
);

export const checklistAccess = pgTable("checklist_access", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: varchar("label").notNull(),
  accessToken: varchar("access_token").unique().notNull(),
  pin: varchar("pin", { length: 4 }),
  sopId: uuid("sop_id")
    .references(() => sops.id)
    .notNull(),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ─── CLIENT FOLLOW-UPS (Sprint 9A) ──────────────────
export const followUpTypeEnum = pgEnum("followup_type", [
  "2_week",
  "1_month",
  "2_month",
  "6_month",
]);

export const clientFollowups = pgTable(
  "client_followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientName: text("client_name").notNull(),
    clientPhone: text("client_phone"),
    artistId: uuid("artist_id").references(() => artists.id),
    appointmentDate: date("appointment_date").notNull(),
    followupType: followUpTypeEnum("followup_type").notNull(),
    dueDate: date("due_date").notNull(),
    contactedAt: timestamp("contacted_at"),
    contactNotes: text("contact_notes"),
    closed: boolean("closed").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("client_followups_due_date_idx").on(t.dueDate),
    index("client_followups_artist_idx").on(t.artistId),
    index("client_followups_closed_idx").on(t.closed),
  ],
);

// ─── QB SYNC QUEUE ───────────────────────────────────
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

export const porterImportLog = pgTable("porter_import_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  importDate: timestamp("import_date").defaultNow(),
  recordCount: integer("record_count").default(0),
  sourceMethod: importMethodEnum("source_method").notNull(),
  status: varchar("status", { length: 20 }).default("success"),
  errors: jsonb("errors").$type<string[]>().default([]),
});

export const meta = pgTable("meta", {
  id: serial("id").primaryKey(),
  lastPorterImport: timestamp("last_porter_import"),
  lastBriefingSent: timestamp("last_briefing_sent"),
  lastQbSync: timestamp("last_qb_sync"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Artist = typeof artists.$inferSelect;
export type NewArtist = typeof artists.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Appointment = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;
export type Nudge = typeof nudges.$inferSelect;
export type NewNudge = typeof nudges.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Sop = typeof sops.$inferSelect;
export type SopRoleAssignment = typeof sopRoleAssignments.$inferSelect;
export type SopChecklistItem = typeof sopChecklistItems.$inferSelect;
export type SopCompletion = typeof sopCompletions.$inferSelect;
export type ExtraTask = typeof extraTasks.$inferSelect;
export type NewExtraTask = typeof extraTasks.$inferInsert;
export type PnlImportHistory = typeof pnlImportHistory.$inferSelect;
export type NewPnlImportHistory = typeof pnlImportHistory.$inferInsert;
export type ChecklistAccess = typeof checklistAccess.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type ClientFollowup = typeof clientFollowups.$inferSelect;
export type NewClientFollowup = typeof clientFollowups.$inferInsert;
