/**
 * MASTER_SPEC_v3 §7 — Briefing synthesis (full snapshot + Claude narrative).
 */
import { callClaude } from "../integrations/anthropic.js";
import * as briefingRepo from "../repos/briefingRepo.js";
import * as expenseRepo from "../repos/expenseRepo.js";
import * as incidentRepo from "../repos/incidentRepo.js";
import * as strategicNoteRepo from "../repos/strategicNoteRepo.js";
import * as taskRepo from "../repos/taskRepo.js";
import * as commissionService from "./commissionService.js";
import * as customerContinuityService from "./customerContinuityService.js";
import {
  getDailySummary,
  getMonthlySummary,
  getWeeklySummary,
} from "./metricsService.js";
import * as pnlService from "./pnlService.js";
import {
  dateLabelInTimezone,
  daysAgoISO,
  endOfDayUTC,
  startOfDayUTC,
  todayISOInTimezone,
} from "../lib/timezone.js";
import * as checklistService from "./checklistService.js";
import * as extraTaskService from "./extraTaskService.js";
import * as followupService from "./followupService.js";

export type BriefingPeriod = "daily" | "weekly" | "monthly";

export type OnDemandBriefingPeriod = "24h" | "7d" | "30d";

const ORACLE_BRIEFING_SYSTEM_PROMPT = `You are Oracle, the AI operations assistant for this business.
Generate a concise operations briefing based on the data provided.
Format your response EXACTLY as follows:
- Use bullet points for every item (• character)
- ✅ for positive items
- ⚠️ for items to watch
- 🔴 for items needing immediate action
- Group by: Revenue, Team, Operations, Follow-ups, Open Items
- Keep each bullet to one sentence
- End with one sentence summary called 'Bottom Line'
- Never use numbered lists
- Never use markdown headers`;

export function snapshotHasBriefingData(snapshot: BriefingDataSnapshot): boolean {
  const metrics = snapshot.metrics as Record<string, unknown>;
  const revenue = Number(metrics["totalRevenue"] ?? metrics["revenue"] ?? 0);
  const appointments = Number(metrics["appointmentCount"] ?? metrics["appointments"] ?? 0);
  return (
    revenue > 0 ||
    appointments > 0 ||
    snapshot.recentExpenses.length > 0 ||
    snapshot.openIncidents.length > 0 ||
    snapshot.openTasks.length > 0 ||
    snapshot.recentNotes.length > 0 ||
    snapshot.followupsDueToday.length > 0 ||
    snapshot.openExtraTasks.length > 0
  );
}

export type BriefingDataSnapshot = {
  period: BriefingPeriod;
  dateLabel: string;
  metrics: Record<string, unknown>;
  recentExpenses: { vendor: string; amount: number; category: string }[];
  openIncidents: { description: string }[];
  openTasks: { description: string; type: string }[];
  recentNotes: { content: string }[];
  nudgesCandidates: {
    customerName: string;
    daysSinceLast: number;
    preferredArtist?: string;
  }[];
  commissionsDue: { artistName: string; amount: number }[];
  sopCompletionsYesterday: string;
  openExtraTasks: {
    description: string;
    loggedBy: string;
    loggedAt: string;
  }[];
  followupsDueToday: {
    clientName: string;
    followupType: string;
    artistName: string | null;
    appointmentDate: string;
  }[];
};

function buildBriefingSystemPrompt(period: BriefingPeriod): string {
  const periodGuidance = {
    daily: "4-8 bullet lines",
    weekly: "8-12 bullet lines",
    monthly: "12-16 bullet lines",
  }[period];

  return `You are writing the ${period} operational briefing for Legion, owner of Fallen Sparrow Tattoo Co. in Kissimmee, FL.

STYLE RULES:
- Use bullet points only. One clear fact, flag, or action per line.
- Start every line with "- " (hyphen and space). No numbered lists. No section headers.
- Plain, direct language. No corporate jargon.
- Be specific. Use exact names, dollar amounts, and numbers from the data snapshot only.
- Put the most important bullet first (usually revenue or something that needs action).
- Warm but efficient. This is an owner reading on his phone at 6am.
- If followupsDueToday has entries, include a bullet listing client names and follow-up types (e.g. 2-week check-in). These are scheduled client touchpoints, not internal tasks.
- If a topic has no data, skip it entirely. Never say "no data available."
- Never invent numbers or facts not present in the snapshot.

LENGTH: ${periodGuidance}

Return only the bullet list. No preamble. No sign-off. Example format:
- Revenue yesterday was $X with Y appointments.
- Open incident: describe the issue.
- Commission due for Artist Name: $Z.`;

}

/** Normalize model output to hyphen-prefixed bullets for UI and email. */
export function formatBriefingAsBullets(raw: string): string {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const stripped = line.replace(/^[-*•]\s+/, "").trim();
      return stripped ? `- ${stripped}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function sinceDateFromISO(anchorISO: string, daysBack: number, timezone: string): Date {
  return startOfDayUTC(daysAgoISO(daysBack, timezone, anchorISO));
}

async function loadSharedSnapshotFields(
  shopId: string,
  expenseSince: Date,
  notesSince: Date,
  commissionFrom: Date,
  commissionTo: Date,
): Promise<
  Pick<
    BriefingDataSnapshot,
    | "recentExpenses"
    | "openIncidents"
    | "openTasks"
    | "recentNotes"
    | "nudgesCandidates"
    | "commissionsDue"
  >
> {
  const [
    recentExpenses,
    openIncidents,
    openTasks,
    recentNotes,
    nudgeCandidates,
    commissionSummary,
  ] = await Promise.all([
    expenseRepo.getRecentExpenses(expenseSince),
    incidentRepo.listOpenIncidents(),
    taskRepo.listOpenTasks(),
    strategicNoteRepo.listRecentStrategicNotes(notesSince),
    customerContinuityService.getNudgeCandidates(shopId),
    commissionService.getAllArtistsCommissionSummary(
      shopId,
      commissionFrom,
      commissionTo,
    ),
  ]);

  return {
    recentExpenses,
    openIncidents,
    openTasks,
    recentNotes,
    nudgesCandidates: nudgeCandidates.map((c) => ({
      customerName: c.name,
      daysSinceLast: c.daysSinceLastAppointment,
      preferredArtist: c.preferredArtistName ?? undefined,
    })),
    commissionsDue: commissionSummary.artists
      .filter((a) => a.totalArtistPayout > 0)
      .map((a) => ({
        artistName: a.artistName,
        amount: a.totalArtistPayout,
      })),
  };
}

export async function synthesizeBriefing(
  snapshot: BriefingDataSnapshot,
  periodStart: Date,
  periodEnd: Date,
): Promise<{ narrativeText: string; briefingId: string }> {
  const systemPrompt = buildBriefingSystemPrompt(snapshot.period);
  const userMessage = `DATA SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`;

  const rawNarrative = await callClaude({
    systemPrompt,
    userMessage,
    maxTokens: 800,
  });
  const narrativeText = formatBriefingAsBullets(rawNarrative);

  const row = await briefingRepo.insertBriefing({
    briefingType: snapshot.period,
    periodStart,
    periodEnd,
    dataSnapshot: snapshot,
    narrative: narrativeText,
  });

  return { narrativeText, briefingId: row.id };
}

export async function synthesizeOnDemandOracleBriefing(
  snapshot: BriefingDataSnapshot,
): Promise<string> {
  const userMessage = `DATA SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`;
  const rawNarrative = await callClaude({
    systemPrompt: ORACLE_BRIEFING_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1000,
  });
  return rawNarrative.trim();
}

export async function assembleOnDemandSnapshot(
  shopId: string,
  period: OnDemandBriefingPeriod,
  timezone: string,
): Promise<BriefingDataSnapshot> {
  const todayISO = todayISOInTimezone(timezone);
  if (period === "24h") {
    return assembleDailySnapshot(shopId, todayISO, timezone);
  }
  if (period === "7d") {
    const startISO = daysAgoISO(6, timezone, todayISO);
    return assembleWeeklySnapshot(shopId, startISO, todayISO, timezone);
  }
  const startISO = daysAgoISO(29, timezone, todayISO);
  return assembleWeeklySnapshot(shopId, startISO, todayISO, timezone);
}

export async function assembleDailySnapshot(
  shopId: string,
  dateISO: string,
  timezone: string,
): Promise<BriefingDataSnapshot> {
  const metrics = await getDailySummary(dateISO);
  const dateLabel = dateLabelInTimezone(dateISO, timezone);

  const dayStart = startOfDayUTC(dateISO);
  const dayEnd = endOfDayUTC(dateISO);
  const yesterdayISO = daysAgoISO(1, timezone, dateISO);
  const [shared, sopCompletionsYesterday, openExtraTasks, followupsDue] = await Promise.all([
    loadSharedSnapshotFields(
      shopId,
      sinceDateFromISO(dateISO, 7, timezone),
      sinceDateFromISO(dateISO, 14, timezone),
      dayStart,
      dayEnd,
    ),
    checklistService.getYesterdaySopSummaryText(yesterdayISO),
    extraTaskService.listOpenExtraTasks(10),
    followupService.getDueToday(timezone),
  ]);

  return {
    period: "daily",
    dateLabel,
    metrics: metrics as unknown as Record<string, unknown>,
    ...shared,
    sopCompletionsYesterday,
    openExtraTasks: openExtraTasks.map((task) => ({
      description: task.description,
      loggedBy: task.loggedByLabel ?? "team",
      loggedAt: task.loggedAt,
    })),
    followupsDueToday: followupsDue.map((f) => ({
      clientName: f.clientName,
      followupType: f.followupType,
      artistName: f.artistName,
      appointmentDate: f.appointmentDate,
    })),
  };
}

export async function assembleWeeklySnapshot(
  shopId: string,
  startISO: string,
  endISO: string,
  timezone: string,
): Promise<BriefingDataSnapshot> {
  const metrics = await getWeeklySummary(startISO, endISO);
  const startLabel = new Date(`${startISO}T12:00:00.000Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", timeZone: timezone },
  );
  const endLabel = new Date(`${endISO}T12:00:00.000Z`).toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric", timeZone: timezone },
  );

  const periodStart = startOfDayUTC(startISO);
  const periodEnd = endOfDayUTC(endISO);
  const shared = await loadSharedSnapshotFields(
    shopId,
    periodStart,
    sinceDateFromISO(endISO, 30, timezone),
    periodStart,
    periodEnd,
  );

  return {
    period: "weekly",
    dateLabel: `Week of ${startLabel} - ${endLabel}`,
    metrics: metrics as unknown as Record<string, unknown>,
    ...shared,
    sopCompletionsYesterday: "",
    openExtraTasks: [],
    followupsDueToday: [],
  };
}

export async function assembleMonthlySnapshot(
  shopId: string,
  year: number,
  month: number,
  timezone: string,
): Promise<BriefingDataSnapshot> {
  const [metrics, pnl] = await Promise.all([
    getMonthlySummary(year, month),
    pnlService.getPnlMonthly(shopId, year, month),
  ]);

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });

  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const monthEndISO = new Date(Date.UTC(year, month, 0, 12, 0, 0))
    .toISOString()
    .slice(0, 10);
  const shared = await loadSharedSnapshotFields(
    shopId,
    periodStart,
    sinceDateFromISO(monthEndISO, 30, timezone),
    periodStart,
    periodEnd,
  );

  return {
    period: "monthly",
    dateLabel: monthLabel,
    metrics: {
      ...(metrics as unknown as Record<string, unknown>),
      pnl,
    },
    ...shared,
    sopCompletionsYesterday: "",
    openExtraTasks: [],
    followupsDueToday: [],
  };
}
