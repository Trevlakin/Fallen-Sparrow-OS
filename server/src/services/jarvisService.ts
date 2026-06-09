/**
 * MASTER_SPEC_v3 §5 — JARVIS parse + grounded extraction + contextual response.
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  brainDumps,
  expenses,
  incidents,
  strategicNotes,
  taskQueue,
} from "@fallen-sparrow/shared/schema";
import {
  CONFIDENCE_THRESHOLD,
  EXPENSE_CATEGORIES,
  FOLLOWUP_TYPE_LABELS,
  type ExpenseCategoryKey,
  type FollowupType,
} from "@fallen-sparrow/shared/constants";
import { db } from "../config/database.js";
import {
  callClaude,
  callClaudeWithImages,
} from "../integrations/anthropic.js";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import * as briefingRepo from "../repos/briefingRepo.js";
import * as expenseRepo from "../repos/expenseRepo.js";
import * as followupRepo from "../repos/followupRepo.js";
import * as incidentRepo from "../repos/incidentRepo.js";
import * as suggestionRepo from "../repos/suggestionRepo.js";
import * as commissionService from "./commissionService.js";
import * as customerContinuityService from "./customerContinuityService.js";
import * as sopService from "./sopService.js";
import * as jarvisTeamCommandService from "./jarvisTeamCommandService.js";
import * as inventoryService from "./inventoryService.js";
import { AppError } from "../utils/errors.js";
import { dedupeBrainDumpOutput } from "../lib/jarvisDedup.js";
import { normalizeJarvisPreview } from "../lib/jarvisPreviewNormalize.js";
import {
  addDaysToISO,
  buildDateReferenceBlock,
  endOfDayUTC,
  startOfDayUTC,
  todayISOInTimezone,
  weekdayLabelInTimezone,
} from "../lib/timezone.js";

const categoryKeys = Object.keys(EXPENSE_CATEGORIES) as [
  ExpenseCategoryKey,
  ...ExpenseCategoryKey[],
];

const ExpenseSchema = z.object({
  vendor: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(categoryKeys),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
  description: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
});

const IncidentSchema = z.object({
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resolutionCost: z.number().nullish(),
  confidence: z.number().min(0).max(1),
});

const TaskSchema = z.object({
  description: z.string().min(1),
  type: z.enum(["follow_up", "staff_note", "admin"]),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullish(),
  confidence: z.number().min(0).max(1),
});

const StrategicNoteSchema = z.object({
  content: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

const SuggestionSchema = z.object({
  rawText: z.string(),
  parsedAs: z.string(),
  reason: z.string(),
});

const JarvisInventoryUpdateSchema = z.object({
  itemName: z.string().min(1),
  action: z.enum(["restock", "depleted", "low_alert"]),
  quantity: z.number().int().optional(),
  confidence: z.number().min(0).max(1),
});

const BrainDumpOutputSchema = z.object({
  expenses: z.array(ExpenseSchema).default([]),
  incidents: z.array(IncidentSchema).default([]),
  tasks: z.array(TaskSchema).default([]),
  strategicNotes: z.array(StrategicNoteSchema).default([]),
  inventoryUpdates: z.array(JarvisInventoryUpdateSchema).default([]),
  suggestions: z.array(SuggestionSchema).default([]),
});

export type BrainDumpOutput = z.infer<typeof BrainDumpOutputSchema>;

export type SuggestionItem = z.infer<typeof SuggestionSchema> & {
  id?: string;
};

export type JarvisInventoryUpdate = z.infer<typeof JarvisInventoryUpdateSchema>;

export type JarvisContext = {
  todaysAppointments: string;
  monthlySpend: string;
  openIncidents: string;
  commissionsDue: string;
  nudgeCandidates: string;
  recentContext: string;
  checklistStatus: string;
  inventoryAlerts: string;
};

const JARVIS_RESPONSE_SYSTEM_PROMPT = `You are JARVIS — the operational intelligence for Fallen Sparrow Tattoo Studio
in Kissimmee, Florida. You work directly for Legion, the owner. You are his
right-hand man. You are sharp, direct, and always across what's happening at
the shop.

Legion just gave you a quick update. Everything has been logged in the system.
Now respond to him in 2-4 sentences maximum. Rules:
- Be specific: use names, dollar amounts, and times from the context
- Lead with what matters most right now
- If something needs his attention, say it directly
- If everything is fine, say so briefly and move on
- Never use bullet points or lists
- Never sound like a corporate assistant or a chatbot
- Sound like someone who knows this shop cold and has his back
- If a dollar amount was just logged, acknowledge it with context
  (e.g. "that puts you at $520 in maintenance this month")
- If checklists are incomplete this morning, mention them directly
  (e.g. "Cleaner checklist not started yet" or "Opening checklist is half done")
- End with one question only if genuinely important — otherwise don't ask`;

function buildCategoryBlock(): string {
  return (
    "EXPENSE CATEGORIES (use the key exactly as shown):\n" +
    Object.entries(EXPENSE_CATEGORIES)
      .map(([key, val]) => `- ${key}: ${val.name} (GL: ${val.qbAccount})`)
      .join("\n")
  );
}

function buildSystemPrompt(dateBlock: string, categoryBlock: string): string {
  return `You are an operations assistant for Fallen Sparrow Tattoo Co. in Kissimmee, FL.
Parse the owner's brain dump into structured JSON.

${dateBlock}

${categoryBlock}

OUTPUT RULES (follow every one):
1. Extract ONLY what is clearly stated. Never invent vendors, dates, or categories that are not implied by the dump.
2. Confidence ≥ 0.85: include in the relevant array (expenses, incidents, tasks, strategicNotes). For approximate amounts ("maybe $60", "about $30", "split between us"), use best judgment on the shop's share, set confidence 0.86-0.92, and note uncertainty in the description.
3. Use suggestions[] only when the item cannot be placed in any typed array: no numeric amount at all, contradictory facts, or intent is genuinely unclear. Never put the same item in both a typed array and suggestions[].
4. Resolve relative dates (yesterday, last Tuesday) using the DATE REFERENCE above. Never compute dates yourself.
5. An expense without any numeric clue is NOT an expense — use a staff_note task or strategic note instead. Approximate or split amounts still count as numeric clues.
6. INCIDENTS = mechanical or functional problems with the shop itself (equipment, HVAC/AC, plumbing, electrical, sterilization, facility). The issue is happening or has happened on-site. Describe the problem, not a to-do. Never assign incidents to a person. Never invent resolution cost.
7. TASKS = people-driven or business to-dos that are NOT shop mechanical failures: customer/artist follow-ups (follow_up), ordering supplies or scheduling non-facility work (admin), internal staff notes (staff_note). type must be exactly: follow_up, staff_note, or admin.
8. NO DUPLICATES: Never put the same real-world issue in both incidents and tasks. If the AC is failing, the slow drain, or equipment is broken, use incidents ONLY. Do not also add a task to "schedule repair" or "call service" for that same issue — resolution happens on the Incidents page.
9. Examples: "AC cycling on and off" → incident only. "Back sink drain slow" → incident only. "Follow up with Marcus" → task follow_up. "Order gloves" → task admin. "Call landlord about parking" → task admin or follow_up. "Raise piercing prices 15%" → strategicNotes.
10. If nothing belongs in a category, return an empty array for it. Never omit a key.
11. INVENTORY UPDATES: extract to inventoryUpdates[] when the user
   mentions supply levels or purchases.
   action='restock': purchased/received stock. quantity = units received.
   action='depleted': completely out of something.
   action='low_alert': mentioned being low (may include current count).
   Examples:
     'got 3 boxes of round liners' → restock, quantity: 3
     'used the last thermal paper roll' → depleted
     'down to 2 bottles of black ink' → low_alert, quantity implied at 2
     'received 12 shop hoodies for merch' → restock (merchandise item)
   Confidence ≥ 0.85 only. Never invent item names.
12. QUERY and COMMAND inputs are handled before this parser (not in this JSON).
   - QUERY: reports, recaps, performance, expenses, SOP status, comparisons, health checks.
   - COMMAND: team PIN change, add employee to a role, deactivate employee.
   Return empty arrays for all categories. Do not put queries or commands in suggestions[].
   Command examples (handled elsewhere): ${jarvisTeamCommandService.JARVIS_TEAM_COMMAND_HINTS.join("; ")}
13. Return ONLY valid JSON. No preamble. No markdown fences.

JSON shape:
{
  "expenses": [{ "vendor": string, "amount": number, "category": CategoryKey, "date": "YYYY-MM-DD", "confidence": number, "description": string }],
  "incidents": [{ "description": string, "date": "YYYY-MM-DD", "resolutionCost": number|null, "confidence": number }],
  "tasks": [{ "description": string, "type": "follow_up"|"staff_note"|"admin", "dueDate": "YYYY-MM-DD"|null, "confidence": number }],
  "strategicNotes": [{ "content": string, "confidence": number }],
  "inventoryUpdates": [{ "itemName": string, "action": "restock"|"depleted"|"low_alert", "quantity": number|null, "confidence": number }],
  "suggestions": [{ "rawText": string, "parsedAs": string, "reason": string }]
}`;
}

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function formatBrainDumpParseError(err: unknown): string {
  if (err instanceof z.ZodError) {
    const summary = err.issues
      .slice(0, 3)
      .map((issue) => {
        const path =
          issue.path.length > 0 ? issue.path.join(".") : "response";
        return `${path}: ${issue.message}`;
      })
      .join("; ");
    const suffix = err.issues.length > 3 ? " (and more)" : "";
    return `Could not understand that update (${summary}${suffix}). Try rephrasing with clear dates and amounts.`;
  }
  if (err instanceof SyntaxError) {
    return "AI returned invalid JSON. Please try again.";
  }
  return "Could not parse the brain dump. Please try again.";
}

function mapParsedAsToProposedType(
  parsedAs: string,
): "expense" | "incident" | "admin" | "follow_up" | "staff_note" {
  if (parsedAs.startsWith("task:")) {
    const t = parsedAs.slice(5);
    if (t === "follow_up" || t === "staff_note" || t === "admin") {
      return t;
    }
  }
  if (parsedAs === "expense") return "expense";
  if (parsedAs === "incident") return "incident";
  if (parsedAs === "strategic_note") return "admin";
  return "admin";
}

function formatTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

function formatCategoryLabel(categoryKey: string): string {
  const key = categoryKey as ExpenseCategoryKey;
  return EXPENSE_CATEGORIES[key]?.name ?? categoryKey;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysSince(date: Date): number {
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

function firstTwoSentences(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const matches = trimmed.match(/[^.!?]+[.!?]+/g);
  if (!matches || matches.length === 0) return trimmed.slice(0, 200);
  return matches.slice(0, 2).join(" ").trim();
}

function weekBounds(timezone: string): { from: Date; to: Date; fridayLabel: string } {
  const todayISO = todayISOInTimezone(timezone);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(new Date(`${todayISO}T12:00:00.000Z`));
  const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    weekday.slice(0, 3),
  );
  const daysToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
  const mondayISO = addDaysToISO(todayISO, -daysToMonday);
  const sundayISO = addDaysToISO(mondayISO, 6);
  const fridayISO = addDaysToISO(mondayISO, 4);
  return {
    from: startOfDayUTC(mondayISO),
    to: endOfDayUTC(sundayISO),
    fridayLabel: weekdayLabelInTimezone(fridayISO, timezone),
  };
}

function monthBounds(timezone: string): { from: Date; to: Date } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? now.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 1);
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { from, to };
}

function todayBounds(timezone: string): { from: Date; to: Date; dateISO: string } {
  const dateISO = todayISOInTimezone(timezone);
  return {
    dateISO,
    from: startOfDayUTC(dateISO),
    to: endOfDayUTC(dateISO),
  };
}

function summarizeTodaysAppointments(
  rows: appointmentRepo.TodayAppointmentRow[],
  timezone: string,
): string {
  if (rows.length === 0) {
    return "No appointments on the books today.";
  }
  const countLabel = `${rows.length} appointment${rows.length === 1 ? "" : "s"} today.`;
  const now = Date.now();
  const upcoming = rows.find((r) => r.appointmentDate.getTime() >= now) ?? rows[0];
  const last = rows[rows.length - 1];
  const nextArtist = upcoming?.artistName ?? "TBD";
  const nextTime = upcoming
    ? formatTime(upcoming.appointmentDate, timezone)
    : "";
  const nextService = upcoming?.serviceType.replace(/_/g, " ") ?? "";
  const lastTime = last ? formatTime(last.appointmentDate, timezone) : "";
  return `${countLabel} Next: ${nextArtist} at ${nextTime} (${nextService}). Last one at ${lastTime}.`;
}

function summarizeMonthlySpend(
  totals: expenseRepo.ExpenseCategoryTotal[],
): string {
  if (totals.length === 0) {
    return "No expenses logged this month yet.";
  }
  const parts = totals
    .filter((t) => t.total > 0)
    .map((t) => `${formatCategoryLabel(t.category)} ${formatCurrency(t.total)}`);
  return parts.length > 0
    ? `This month: ${parts.join(", ")}.`
    : "No expenses logged this month yet.";
}

function summarizeOpenIncidents(
  rows: incidentRepo.OpenIncidentRow[],
): string {
  if (rows.length === 0) {
    return "No open incidents.";
  }
  const first = rows[0];
  if (!first) return "No open incidents.";
  const logged = first.createdAt ? daysSince(first.createdAt) : 0;
  const countLabel =
    rows.length === 1
      ? `1 open incident: ${first.description}`
      : `${rows.length} open incidents. Latest: ${first.description}`;
  return `${countLabel} (logged ${logged} day${logged === 1 ? "" : "s"} ago, unresolved).`;
}

function summarizeCommissionsDue(
  artists: { artistName: string; amount: number }[],
  fridayLabel: string,
): string {
  if (artists.length === 0) {
    return "No artist commissions due this week.";
  }
  return artists
    .map((a) => `${a.artistName}: ${formatCurrency(a.amount)} due ${fridayLabel}`)
    .join(". ")
    .concat(".");
}

export async function assembleJarvisContext(
  shopId: string,
  timezone = "America/New_York",
): Promise<JarvisContext> {
  const { from: todayFrom, to: todayTo } = todayBounds(timezone);
  const { from: monthFrom, to: monthTo } = monthBounds(timezone);
  const { from: weekFrom, to: weekTo, fridayLabel } = weekBounds(timezone);

  const [
    appointments,
    expenseTotals,
    openIncidents,
    nudgeCandidates,
    commissionSummary,
    latestBriefing,
    checklistStatuses,
    inventorySnap,
  ] = await Promise.all([
    appointmentRepo.listTodaysAppointments(todayFrom, todayTo),
    expenseRepo.sumExpensesByCategory(shopId, monthFrom, monthTo),
    incidentRepo.listOpenIncidentsDetailed(3),
    customerContinuityService.getNudgeCandidates(shopId),
    commissionService.getAllArtistsCommissionSummary(shopId, weekFrom, weekTo),
    briefingRepo.findLatestBriefing("daily"),
    sopService.getTodayStatusAllRoles(undefined, timezone),
    inventoryService.getInventorySnapshot(),
  ]);

  const commissionsDue = commissionSummary.artists
    .filter((a) => a.totalArtistPayout > 0)
    .map((a) => ({
      artistName: a.artistName,
      amount: a.totalArtistPayout,
    }));

  const inventoryAlerts =
    inventorySnap.outCount > 0 || inventorySnap.lowCount > 0
      ? `Out: ${inventorySnap.outItems.map((i) => i.name).join(", ") || "none"}. Low: ${inventorySnap.lowItems.map((i) => i.name).join(", ") || "none"}.`
      : "All supplies stocked.";

  return {
    todaysAppointments: summarizeTodaysAppointments(appointments, timezone),
    monthlySpend: summarizeMonthlySpend(expenseTotals),
    openIncidents: summarizeOpenIncidents(openIncidents),
    commissionsDue: summarizeCommissionsDue(commissionsDue, fridayLabel),
    nudgeCandidates:
      nudgeCandidates.length === 0
        ? "No clients overdue for a visit."
        : `${nudgeCandidates.length} client${nudgeCandidates.length === 1 ? "" : "s"} overdue for a visit.`,
    recentContext: latestBriefing?.narrative
      ? firstTwoSentences(latestBriefing.narrative)
      : "No recent briefing on file.",
    checklistStatus: sopService.summarizeChecklistStatus(checklistStatuses),
    inventoryAlerts,
  };
}

function summarizeParsedForJarvis(
  parsed: BrainDumpOutput,
  committed: {
    expenses: number;
    incidents: number;
    tasks: number;
    strategicNotes: number;
    inventoryUpdates: number;
  },
): string {
  const parts: string[] = [];
  if (committed.expenses > 0) {
    const expenseLines = parsed.expenses
      .slice(0, committed.expenses)
      .map(
        (e) =>
          `$${e.amount.toFixed(0)} ${formatCategoryLabel(e.category)} (${e.vendor || e.description})`,
      );
    parts.push(
      `${committed.expenses} expense${committed.expenses === 1 ? "" : "s"} logged: ${expenseLines.join("; ")}`,
    );
  }
  if (committed.incidents > 0) {
    parts.push(
      `${committed.incidents} incident${committed.incidents === 1 ? "" : "s"} noted`,
    );
  }
  if (committed.tasks > 0) {
    parts.push(
      `${committed.tasks} task${committed.tasks === 1 ? "" : "s"} captured`,
    );
  }
  if (committed.strategicNotes > 0) {
    parts.push(
      `${committed.strategicNotes} strategic note${committed.strategicNotes === 1 ? "" : "s"} saved`,
    );
  }
  if (committed.inventoryUpdates > 0) {
    parts.push(
      `${committed.inventoryUpdates} inventory update${committed.inventoryUpdates === 1 ? "" : "s"} applied`,
    );
  }
  if (parsed.suggestions.length > 0) {
    parts.push(
      `${parsed.suggestions.length} item${parsed.suggestions.length === 1 ? "" : "s"} in Miscellaneous`,
    );
  }
  if (parts.length === 0) {
    return "Legion shared an update but nothing met the confidence threshold for automatic logging.";
  }
  return parts.join(". ") + ".";
}

export async function generateJarvisResponse(
  parsedItems: BrainDumpOutput,
  context: JarvisContext,
  committed: {
    expenses: number;
    incidents: number;
    tasks: number;
    strategicNotes: number;
    inventoryUpdates: number;
  },
): Promise<string> {
  const parsedSummary = summarizeParsedForJarvis(parsedItems, committed);
  const userMessage = `WHAT LEGION JUST TOLD ME:
${parsedSummary}

TODAY'S CONTEXT:
Today's appointments: ${context.todaysAppointments}
Monthly spend: ${context.monthlySpend}
Open incidents: ${context.openIncidents}
Commissions due: ${context.commissionsDue}
Nudge candidates: ${context.nudgeCandidates}
Checklist status: ${context.checklistStatus}
Inventory: ${context.inventoryAlerts}
Recent briefing: ${context.recentContext}`;

  return callClaude({
    systemPrompt: JARVIS_RESPONSE_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 300,
  });
}

export async function parseJarvisInput(input: {
  shopId: string;
  userId?: string;
  rawText: string;
  images?: { mediaType: string; base64Data: string }[];
  timezone?: string;
}): Promise<{
  committed: {
    expenses: number;
    incidents: number;
    tasks: number;
    strategicNotes: number;
    inventoryUpdates: number;
  };
  suggestions: SuggestionItem[];
  rawParsed: BrainDumpOutput;
}> {
  const timezone = input.timezone ?? "America/New_York";
  const { block: dateBlock } = buildDateReferenceBlock(timezone);
  const categoryBlock = buildCategoryBlock();
  const systemPrompt = buildSystemPrompt(dateBlock, categoryBlock);

  let rawJson: string;
  if (input.images && input.images.length > 0) {
    const images = input.images.map((img) => {
      const mediaType = img.mediaType as
        | "image/jpeg"
        | "image/png"
        | "image/webp";
      return { mediaType, base64Data: img.base64Data };
    });
    rawJson = await callClaudeWithImages({
      systemPrompt,
      userMessage: input.rawText,
      images,
      maxTokens: 1500,
    });
  } else {
    rawJson = await callClaude({
      systemPrompt,
      userMessage: input.rawText,
      maxTokens: 1500,
    });
  }

  let parsed: BrainDumpOutput;
  try {
    const clean = stripMarkdownFences(rawJson);
    parsed = BrainDumpOutputSchema.parse(JSON.parse(clean));
  } catch (err) {
    throw new AppError(formatBrainDumpParseError(err), 422);
  }

  parsed = dedupeBrainDumpOutput(parsed);

  const [brainDumpRow] = await db
    .insert(brainDumps)
    .values({
      authorUserId: input.userId,
      rawInput: input.rawText,
      inputType: input.images?.length ? "image" : "text",
      parseResult: parsed,
    })
    .returning({ id: brainDumps.id });

  const brainDumpId = brainDumpRow?.id ?? null;
  const committed = {
    expenses: 0,
    incidents: 0,
    tasks: 0,
    strategicNotes: 0,
    inventoryUpdates: 0,
  };

  const confidentExpenses = parsed.expenses.filter(
    (e) => e.confidence >= CONFIDENCE_THRESHOLD,
  );
  if (confidentExpenses.length > 0) {
    await db.insert(expenses).values(
      confidentExpenses.map((e) => ({
        loggedByUserId: input.userId,
        description: e.description || e.vendor,
        amount: e.amount.toFixed(2),
        category: e.category,
        qbGlAccount: EXPENSE_CATEGORIES[e.category].qbAccount,
        expenseDate: new Date(e.date),
        aiConfidence: e.confidence.toFixed(2),
        receiptUrl: null,
        needsReview: false,
      })),
    );
    committed.expenses = confidentExpenses.length;
  }

  const confidentIncidents = parsed.incidents.filter(
    (i) => i.confidence >= CONFIDENCE_THRESHOLD,
  );
  if (confidentIncidents.length > 0) {
    for (const i of confidentIncidents) {
      const extractedAmount = typeof i.resolutionCost === "number" && i.resolutionCost > 0
        ? i.resolutionCost
        : 0;

      let linkedExpenseId: string | undefined;
      if (extractedAmount > 0) {
        const [expRow] = await db
          .insert(expenses)
          .values({
            loggedByUserId: input.userId,
            description: `Maintenance: ${i.description}`,
            amount: extractedAmount.toFixed(2),
            category: "MAINTENANCE",
            qbGlAccount: EXPENSE_CATEGORIES.MAINTENANCE.qbAccount,
            expenseDate: new Date(i.date),
            aiConfidence: i.confidence.toFixed(2),
            needsReview: false,
            source: "jarvis",
          })
          .returning({ id: expenses.id });
        linkedExpenseId = expRow?.id;
        committed.expenses += 1;
      }

      await db.insert(incidents).values({
        loggedByUserId: input.userId,
        incidentType: "operational" as const,
        description: i.description,
        status: "open" as const,
        occurredDate: new Date(i.date),
        ...(linkedExpenseId ? {
          linkedExpenseId,
          linkedExpenseAmount: Math.round(extractedAmount),
        } : {}),
      });
    }
    committed.incidents = confidentIncidents.length;
  }

  const confidentTasks = parsed.tasks.filter(
    (t) => t.confidence >= CONFIDENCE_THRESHOLD,
  );
  if (confidentTasks.length > 0) {
    await db.insert(taskQueue).values(
      confidentTasks.map((t) => ({
        type: t.type,
        title: t.description.slice(0, 500),
        description: t.description,
        status: "open" as const,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
      })),
    );
    committed.tasks = confidentTasks.length;
  }

  const confidentNotes = parsed.strategicNotes.filter(
    (n) => n.confidence >= CONFIDENCE_THRESHOLD,
  );
  if (confidentNotes.length > 0) {
    for (const n of confidentNotes) {
      let aiExpansion: string | undefined;
      try {
        aiExpansion = await generateNoteExpansion(n.content);
      } catch {
        aiExpansion = undefined;
      }
      await db.insert(strategicNotes).values({
        authorUserId: input.userId,
        content: n.content,
        ...(aiExpansion ? { aiExpansion } : {}),
      });
    }
    committed.strategicNotes = confidentNotes.length;
  }

  const autoSuggestions: SuggestionItem[] = [
    ...parsed.expenses
      .filter((e) => e.confidence < CONFIDENCE_THRESHOLD)
      .map((e) => ({
        rawText: e.description || e.vendor,
        parsedAs: "expense",
        reason: `Confidence ${e.confidence} below threshold`,
      })),
    ...parsed.incidents
      .filter((i) => i.confidence < CONFIDENCE_THRESHOLD)
      .map((i) => ({
        rawText: i.description,
        parsedAs: "incident",
        reason: `Confidence ${i.confidence} below threshold`,
      })),
    ...parsed.tasks
      .filter((t) => t.confidence < CONFIDENCE_THRESHOLD)
      .map((t) => ({
        rawText: t.description,
        parsedAs: `task:${t.type}`,
        reason: `Confidence ${t.confidence} below threshold`,
      })),
    ...parsed.strategicNotes
      .filter((n) => n.confidence < CONFIDENCE_THRESHOLD)
      .map((n) => ({
        rawText: n.content,
        parsedAs: "strategic_note",
        reason: `Confidence ${n.confidence} below threshold`,
      })),
    ...parsed.inventoryUpdates
      .filter((u) => u.confidence < CONFIDENCE_THRESHOLD)
      .map((u) => ({
        rawText: u.itemName,
        parsedAs: "inventory",
        reason: `Confidence ${u.confidence} below threshold`,
      })),
    ...parsed.suggestions,
  ];

  const confidentInventory = parsed.inventoryUpdates.filter(
    (u) => u.confidence >= CONFIDENCE_THRESHOLD,
  );
  if (confidentInventory.length > 0) {
    const result = await inventoryService.processJarvisInventoryUpdate(
      confidentInventory,
      input.userId,
    );
    committed.inventoryUpdates = result.processed;
    for (const name of result.unresolved) {
      autoSuggestions.push({
        rawText: name,
        parsedAs: "inventory",
        reason: "Could not match inventory item name",
      });
    }
  }

  const persistedSuggestions: SuggestionItem[] = [];
  for (const s of autoSuggestions) {
    const row = await suggestionRepo.insertSuggestion({
      brainDumpId,
      proposedType: mapParsedAsToProposedType(s.parsedAs),
      rawText: s.rawText,
      parsedPayload: { parsedAs: s.parsedAs, reason: s.reason },
      aiConfidence: null,
    });
    persistedSuggestions.push({
      id: row.id,
      rawText: s.rawText,
      parsedAs: s.parsedAs,
      reason: s.reason,
    });
  }

  return {
    committed,
    suggestions: persistedSuggestions,
    rawParsed: parsed,
  };
}

// ─── PREVIEW: parse only, no DB writes ───────────────────────────────────────

export interface PreviewExpense {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  category: ExpenseCategoryKey;
  date: string;
  confidence: number;
}

export interface PreviewTask {
  id: string;
  description: string;
  taskType: "follow_up" | "staff_note" | "admin";
  dueDate: string | null;
  confidence: number;
}

export interface PreviewIncident {
  id: string;
  description: string;
  date: string;
  confidence: number;
}

export interface PreviewNote {
  id: string;
  content: string;
  confidence: number;
}

export interface PreviewInventoryUpdate {
  id: string;
  itemName: string;
  action: "restock" | "depleted" | "low_alert";
  quantity: number | null;
  confidence: number;
}

export interface PreviewSuggestion {
  id: string;
  rawText: string;
  parsedAs: string;
  reason: string;
}

export interface JarvisPreview {
  expenses: PreviewExpense[];
  tasks: PreviewTask[];
  incidents: PreviewIncident[];
  notes: PreviewNote[];
  inventoryUpdates: PreviewInventoryUpdate[];
  suggestions: PreviewSuggestion[];
}

export async function previewJarvisInput(input: {
  rawText: string;
  images?: { mediaType: string; base64Data: string }[];
  timezone?: string;
}): Promise<JarvisPreview> {
  const timezone = input.timezone ?? "America/New_York";
  const { block: dateBlock } = buildDateReferenceBlock(timezone);
  const systemPrompt = buildSystemPrompt(dateBlock, buildCategoryBlock());

  let rawJson: string;
  if (input.images && input.images.length > 0) {
    const images = input.images.map((img) => ({
      mediaType: img.mediaType as "image/jpeg" | "image/png" | "image/webp",
      base64Data: img.base64Data,
    }));
    rawJson = await callClaudeWithImages({ systemPrompt, userMessage: input.rawText, images, maxTokens: 1500 });
  } else {
    rawJson = await callClaude({ systemPrompt, userMessage: input.rawText, maxTokens: 1500 });
  }

  let parsed: BrainDumpOutput;
  try {
    parsed = BrainDumpOutputSchema.parse(JSON.parse(stripMarkdownFences(rawJson)));
  } catch (err) {
    throw new AppError(formatBrainDumpParseError(err), 422);
  }

  parsed = dedupeBrainDumpOutput(parsed);

  const todayISO = todayISOInTimezone(timezone);
  const { inventoryUpdates, ...previewParsed } = parsed;
  const normalized = normalizeJarvisPreview(
    {
      ...previewParsed,
      tasks: previewParsed.tasks.map((t) => ({
        ...t,
        dueDate: t.dueDate ?? null,
      })),
    },
    todayISO,
  );

  return {
    expenses: normalized.expenses,
    tasks: normalized.tasks,
    incidents: normalized.incidents,
    notes: normalized.notes,
    inventoryUpdates: inventoryUpdates.map((u) => ({
      id: randomUUID(),
      itemName: u.itemName,
      action: u.action,
      quantity: u.quantity ?? null,
      confidence: u.confidence,
    })),
    suggestions: normalized.suggestions,
  };
}

// ─── APPROVE: commit user-reviewed items ─────────────────────────────────────

const ApprovedExpenseSchema = z.object({
  description: z.string().min(1),
  amount: z.number().positive(),
  category: z.enum(categoryKeys),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  receiptUrl: z.string().min(1).optional(),
});

const ApprovedTaskSchema = z.object({
  description: z.string().min(1),
  taskType: z.enum(["follow_up", "staff_note", "admin"]),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

const ApprovedIncidentSchema = z.object({
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const ApprovedNoteSchema = z.object({
  content: z.string().min(1),
});

const ApprovedInventorySchema = z.object({
  itemName: z.string().min(1),
  action: z.enum(["restock", "depleted", "low_alert"]),
  quantity: z.number().int().optional(),
});

export const ApprovePayloadSchema = z.object({
  rawText: z.string().default(""),
  expenses: z.array(ApprovedExpenseSchema).default([]),
  tasks: z.array(ApprovedTaskSchema).default([]),
  incidents: z.array(ApprovedIncidentSchema).default([]),
  notes: z.array(ApprovedNoteSchema).default([]),
  inventoryUpdates: z.array(ApprovedInventorySchema).default([]),
});

export type ApprovePayload = z.infer<typeof ApprovePayloadSchema>;

export async function approveJarvisItems(
  userId: string | undefined,
  payload: ApprovePayload,
): Promise<{
  expenses: number;
  tasks: number;
  incidents: number;
  notes: number;
  inventoryUpdates: number;
}> {
  await db.insert(brainDumps).values({
    authorUserId: userId,
    rawInput: payload.rawText || "(approved via JARVIS review panel)",
    inputType: "text",
    parseResult: null,
  });

  const committed = { expenses: 0, tasks: 0, incidents: 0, notes: 0, inventoryUpdates: 0 };

  if (payload.expenses.length > 0) {
    await db.insert(expenses).values(
      payload.expenses.map((e) => ({
        loggedByUserId: userId,
        description: e.description,
        amount: e.amount.toFixed(2),
        category: e.category,
        qbGlAccount: EXPENSE_CATEGORIES[e.category].qbAccount,
        expenseDate: new Date(e.date),
        aiConfidence: "1.00",
        needsReview: false,
      })),
    );
    committed.expenses = payload.expenses.length;
  }

  if (payload.incidents.length > 0) {
    await db.insert(incidents).values(
      payload.incidents.map((i) => ({
        loggedByUserId: userId,
        incidentType: "operational" as const,
        description: i.description,
        status: "open" as const,
        occurredDate: new Date(i.date),
      })),
    );
    committed.incidents = payload.incidents.length;
  }

  if (payload.tasks.length > 0) {
    await db.insert(taskQueue).values(
      payload.tasks.map((t) => ({
        type: t.taskType,
        title: t.description.slice(0, 500),
        description: t.description,
        status: "open" as const,
        dueDate: t.dueDate ? new Date(t.dueDate) : null,
      })),
    );
    committed.tasks = payload.tasks.length;
  }

  if (payload.notes.length > 0) {
    await db.insert(strategicNotes).values(
      payload.notes.map((n) => ({
        authorUserId: userId,
        content: n.content,
      })),
    );
    committed.notes = payload.notes.length;
  }

  if (payload.inventoryUpdates.length > 0) {
    const result = await inventoryService.processJarvisInventoryUpdate(
      payload.inventoryUpdates.map((u) => ({
        itemName: u.itemName,
        action: u.action,
        quantity: u.quantity,
        confidence: 1,
      })),
      userId,
    );
    committed.inventoryUpdates = result.processed;
  }

  return committed;
}

export async function promoteSuggestion(
  suggestionId: string,
  userId: string | undefined,
): Promise<void> {
  const row = await suggestionRepo.findById(suggestionId);
  if (!row || row.status !== "pending") {
    throw new AppError("Suggestion not found or already handled", 404);
  }

  const payload = (row.parsedPayload ?? {}) as Record<string, unknown>;
  const parsedAs = String(payload["parsedAs"] ?? row.proposedType);

  if (parsedAs === "expense" || row.proposedType === "expense") {
    throw new AppError(
      "Expense suggestions require manual entry; payload lacks structured expense fields",
      400,
    );
  }

  if (parsedAs === "incident" || row.proposedType === "incident") {
    await db.insert(incidents).values({
      loggedByUserId: userId,
      incidentType: "operational",
      description: row.rawText,
      status: "open",
      occurredDate: new Date(),
    });
  } else if (
    row.proposedType === "follow_up" ||
    row.proposedType === "staff_note" ||
    row.proposedType === "admin"
  ) {
    await db.insert(taskQueue).values({
      type: row.proposedType,
      title: row.rawText.slice(0, 500),
      description: row.rawText,
      status: "open",
    });
  } else {
    await db.insert(strategicNotes).values({
      authorUserId: userId,
      content: row.rawText,
    });
  }

  await suggestionRepo.markPromoted(suggestionId);
}

export async function dismissSuggestion(suggestionId: string): Promise<void> {
  const row = await suggestionRepo.findById(suggestionId);
  if (!row || row.status !== "pending") {
    throw new AppError("Suggestion not found or already handled", 404);
  }
  await suggestionRepo.markDismissed(suggestionId);
}

// ─── EXPENSE_LOG: direct focused expense extraction ──────────────────────────

interface ExtractedExpense {
  amount: number;
  description: string;
  vendor: string | null;
  category: ExpenseCategoryKey;
  paymentMethod: string | null;
  date: string;
  confidence: number;
}

const ExtractedExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().default(""),
  vendor: z.string().nullable().default(null),
  category: z.enum(categoryKeys),
  paymentMethod: z.string().nullable().default(null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  confidence: z.number().min(0).max(1),
});

async function extractExpenseFromText(
  input: string,
  todayISO: string,
): Promise<ExtractedExpense> {
  const categoryList = Object.entries(EXPENSE_CATEGORIES)
    .map(([key, val]) => `${key}: ${val.name} (${val.description})`)
    .join(", ");

  const rawJson = await callClaude({
    systemPrompt: `Extract expense details from this text. Return JSON only. No markdown.
Fields: amount (number), description (string), vendor (string or null),
category (one of: ${categoryList}),
paymentMethod (string or null), date (YYYY-MM-DD, use ${todayISO} if not specified),
confidence (0.0-1.0, how certain you are about category).
If you cannot determine category with confidence >= 0.85, set confidence below 0.85.
Return ONLY valid JSON, no preamble.`,
    userMessage: input,
    maxTokens: 400,
  });

  try {
    const clean = rawJson
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return ExtractedExpenseSchema.parse(JSON.parse(clean));
  } catch {
    throw new AppError("Could not parse expense details. Please try again.", 422);
  }
}

export interface ExpenseLogResult {
  expenseId: string;
  amount: number;
  description: string;
  category: string;
  vendor: string | null;
  confidence: number;
  committed: boolean;
  message: string;
}

export async function logExpenseDirect(
  userId: string | undefined,
  rawText: string,
  todayISO: string,
): Promise<ExpenseLogResult> {
  const extracted = await extractExpenseFromText(rawText, todayISO);
  const categoryMeta = EXPENSE_CATEGORIES[extracted.category];

  if (extracted.confidence >= CONFIDENCE_THRESHOLD) {
    const [row] = await db
      .insert(expenses)
      .values({
        loggedByUserId: userId,
        description: extracted.description || extracted.vendor || rawText.slice(0, 200),
        amount: extracted.amount.toFixed(2),
        category: extracted.category,
        qbGlAccount: categoryMeta.qbAccount,
        expenseDate: new Date(extracted.date),
        aiConfidence: extracted.confidence.toFixed(2),
        needsReview: false,
        source: "jarvis",
      })
      .returning({ id: expenses.id });

    const expenseId = row?.id ?? "";
    const vendorStr = extracted.vendor ? ` — ${extracted.vendor}` : "";
    const message = `Logged: $${extracted.amount.toFixed(0)}${vendorStr} — ${extracted.description || "Expense"} (${categoryMeta.name})`;

    return {
      expenseId,
      amount: extracted.amount,
      description: extracted.description || extracted.vendor || "",
      category: extracted.category,
      vendor: extracted.vendor,
      confidence: extracted.confidence,
      committed: true,
      message,
    };
  }

  const [suggRow] = await db
    .insert(expenses)
    .values({
      loggedByUserId: userId,
      description: extracted.description || extracted.vendor || rawText.slice(0, 200),
      amount: extracted.amount.toFixed(2),
      category: extracted.category,
      qbGlAccount: categoryMeta.qbAccount,
      expenseDate: new Date(extracted.date),
      aiConfidence: extracted.confidence.toFixed(2),
      needsReview: true,
      source: "jarvis",
    })
    .returning({ id: expenses.id });

  const expenseId = suggRow?.id ?? "";
  const message = `Logged $${extracted.amount.toFixed(0)} — ${extracted.description || "Expense"} — category unclear, filed as ${categoryMeta.name}. Tap to edit.`;

  return {
    expenseId,
    amount: extracted.amount,
    description: extracted.description || extracted.vendor || "",
    category: extracted.category,
    vendor: extracted.vendor,
    confidence: extracted.confidence,
    committed: false,
    message,
  };
}

// ─── STRATEGIC NOTE: AI expansion ────────────────────────────────────────────

export async function generateNoteExpansion(noteText: string): Promise<string> {
  return callClaude({
    systemPrompt: `You are a business advisor for a tattoo studio. Return ONLY 3 bullet points (one per line, starting with "- "), no intro text.`,
    userMessage: `The owner shared this idea: "${noteText}"\n\nGive exactly 3 concise bullet points on what would make this successful quickly. Be specific to a tattoo studio.`,
    maxTokens: 300,
  });
}

export async function expandStrategicNote(noteId: string): Promise<string> {
  const rows = await db
    .select({ id: strategicNotes.id, content: strategicNotes.content })
    .from(strategicNotes)
    .where(eq(strategicNotes.id, noteId))
    .limit(1);

  const note = rows[0];
  if (!note) {
    throw new AppError("Strategic note not found", 404);
  }

  const expansion = await generateNoteExpansion(note.content);

  await db
    .update(strategicNotes)
    .set({ aiExpansion: expansion })
    .where(eq(strategicNotes.id, noteId));

  return expansion;
}

// ─── FOLLOW-UP QUERIES ────────────────────────────────────────────────────────

export async function queryFollowUps(
  subType: string,
): Promise<string> {
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(today.getDate() + 7);

  const todayISO = today.toISOString().split("T")[0]!;
  const weekISO = sevenDaysLater.toISOString().split("T")[0]!;

  const due = await followupRepo.listDueToday(todayISO);
  const upcoming = await followupRepo.listUpcoming(todayISO, weekISO);

  if (due.length === 0 && upcoming.length === 0) {
    return "No follow-ups due right now.";
  }

  const parts: string[] = [];
  if (due.length > 0) {
    const label = (type: string) =>
      type in FOLLOWUP_TYPE_LABELS
        ? FOLLOWUP_TYPE_LABELS[type as FollowupType]
        : type;
    parts.push(
      `Due/overdue (${due.length}): ${due.slice(0, 3).map((f) => `${f.clientName} (${label(f.followupType)})`).join(", ")}${due.length > 3 ? "..." : ""}`,
    );
  }
  if (upcoming.length > 0) {
    parts.push(
      `Coming up this week (${upcoming.length}): ${upcoming.slice(0, 3).map((f) => `${f.clientName}`).join(", ")}${upcoming.length > 3 ? "..." : ""}`,
    );
  }
  return parts.join("\n");
}
