/**
 * Sprint 8Q: JARVIS query handler. Fetches real shop data and synthesizes bullet responses.
 */
import { EXPENSE_CATEGORIES, type ExpenseCategoryKey } from "@fallen-sparrow/shared/constants";
import { callClaude } from "../integrations/anthropic.js";
import {
  addDaysToISO,
  daysAgoISO,
  endOfDayUTC,
  monthBoundsForYearMonth,
  startOfDayUTC,
  todayISOInTimezone,
} from "../lib/timezone.js";
import type { ClassifiedIntent } from "./jarvisIntentClassifier.js";
import * as checklistService from "./checklistService.js";
import * as extraTaskService from "./extraTaskService.js";
import * as metricsService from "./metricsService.js";
import * as pnlService from "./pnlService.js";

const DEFAULT_TIMEZONE = "America/New_York";

const MONTH_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

export interface QueryDateRange {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  label: string;
}

function parseYearParam(params: Record<string, unknown>, fallback: number): number {
  const raw = params["year"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && /^\d{4}$/.test(raw)) return Number(raw);
  return fallback;
}

function parseMonthIndex(params: Record<string, unknown>): number | null {
  const raw = params["month"];
  if (typeof raw !== "string") return null;
  const idx = MONTH_INDEX[raw.toLowerCase().trim()];
  return idx === undefined ? null : idx;
}

export function parseDateRange(
  params: Record<string, unknown>,
  timezone = DEFAULT_TIMEZONE,
): QueryDateRange {
  const todayISO = todayISOInTimezone(timezone);
  const now = new Date();
  const year = parseYearParam(params, now.getUTCFullYear());

  const monthIndex = parseMonthIndex(params);
  if (monthIndex !== null) {
    const { from, to, monthKey } = monthBoundsForYearMonth(year, monthIndex + 1);
    const endISO = monthKey + `-${String(new Date(year, monthIndex + 1, 0).getUTCDate()).padStart(2, "0")}`;
    return {
      start: from,
      end: to,
      startISO: `${monthKey}-01`,
      endISO,
      label: new Date(`${monthKey}-15T12:00:00.000Z`).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: timezone,
      }),
    };
  }

  const period =
    typeof params["period"] === "string" ? params["period"].toLowerCase() : "";

  switch (period) {
    case "today": {
      return {
        start: startOfDayUTC(todayISO),
        end: endOfDayUTC(todayISO),
        startISO: todayISO,
        endISO: todayISO,
        label: "Today",
      };
    }
    case "yesterday": {
      const y = daysAgoISO(1, timezone, todayISO);
      return {
        start: startOfDayUTC(y),
        end: endOfDayUTC(y),
        startISO: y,
        endISO: y,
        label: "Yesterday",
      };
    }
    case "current_week": {
      const weekday = new Date(`${todayISO}T12:00:00.000Z`).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: timezone,
      });
      const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        weekday.slice(0, 3),
      );
      const daysToMonday = dayIndex === 0 ? 6 : dayIndex - 1;
      const startISO = addDaysToISO(todayISO, -daysToMonday);
      return {
        start: startOfDayUTC(startISO),
        end: endOfDayUTC(todayISO),
        startISO,
        endISO: todayISO,
        label: "This week",
      };
    }
    case "last_week": {
      const weekday = new Date(`${todayISO}T12:00:00.000Z`).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: timezone,
      });
      const dayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
        weekday.slice(0, 3),
      );
      const thisMondayOffset = dayIndex === 0 ? 6 : dayIndex - 1;
      const lastMondayISO = addDaysToISO(todayISO, -thisMondayOffset - 7);
      const lastSundayISO = addDaysToISO(lastMondayISO, 6);
      return {
        start: startOfDayUTC(lastMondayISO),
        end: endOfDayUTC(lastSundayISO),
        startISO: lastMondayISO,
        endISO: lastSundayISO,
        label: "Last week",
      };
    }
    case "last_month": {
      const parts = todayISO.split("-").map(Number);
      const y = parts[0] ?? year;
      const m = parts[1] ?? 1;
      const prevMonth = m === 1 ? 12 : m - 1;
      const prevYear = m === 1 ? y - 1 : y;
      const { from, to, monthKey } = monthBoundsForYearMonth(prevYear, prevMonth);
      const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate();
      return {
        start: from,
        end: to,
        startISO: `${monthKey}-01`,
        endISO: `${monthKey}-${String(lastDay).padStart(2, "0")}`,
        label: new Date(`${monthKey}-15T12:00:00.000Z`).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
          timeZone: timezone,
        }),
      };
    }
    case "ytd": {
      const startISO = `${year}-01-01`;
      return {
        start: startOfDayUTC(startISO),
        end: endOfDayUTC(todayISO),
        startISO,
        endISO: todayISO,
        label: `Year to date ${year}`,
      };
    }
    case "all_time": {
      const startISO = "2020-01-01";
      return {
        start: startOfDayUTC(startISO),
        end: endOfDayUTC(todayISO),
        startISO,
        endISO: todayISO,
        label: "All time",
      };
    }
    case "current_month":
    default: {
      const parts = todayISO.split("-").map(Number);
      const y = parts[0] ?? year;
      const m = parts[1] ?? 1;
      const { from, to, monthKey } = monthBoundsForYearMonth(y, m);
      return {
        start: from,
        end: to,
        startISO: `${monthKey}-01`,
        endISO: todayISO,
        label: "This month",
      };
    }
  }
}

function formatCategoryLabel(categoryKey: string): string {
  const key = categoryKey as ExpenseCategoryKey;
  return EXPENSE_CATEGORIES[key]?.name ?? categoryKey;
}

function artistsFromMonthly(
  byArtist: metricsService.MonthlySummary["byArtist"],
): Array<{ name: string; revenue: number; appointments: number; avgValue: number }> {
  return Object.values(byArtist)
    .map((a) => ({
      name: a.artistName,
      revenue: a.revenue,
      appointments: a.appointmentCount,
      avgValue:
        a.appointmentCount > 0 ? Math.round(a.revenue / a.appointmentCount) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

function artistsFromPeriod(
  byArtist: Record<string, metricsService.ArtistMetrics>,
): Array<{ name: string; revenue: number; appointments: number; avgValue: number }> {
  return Object.values(byArtist)
    .map((a) => ({
      name: a.artistName,
      revenue: a.total.revenue,
      appointments: a.total.count,
      avgValue: a.total.count > 0 ? Math.round(a.total.revenue / a.total.count) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

async function fetchFinancialBundle(
  shopId: string,
  range: QueryDateRange,
): Promise<Record<string, unknown>> {
  const [pnl, periodMetrics] = await Promise.all([
    pnlService.getPnlSummary(shopId, range.start, range.end),
    metricsService.getWeeklySummary(range.startISO, range.endISO).catch(() => null),
  ]);

  const monthlyParts = range.startISO.slice(0, 7).split("-").map(Number);
  const monthly =
    monthlyParts[0] && monthlyParts[1]
      ? await metricsService.getMonthlySummary(monthlyParts[0], monthlyParts[1])
      : null;

  const artists = monthly
    ? artistsFromMonthly(monthly.byArtist)
    : periodMetrics
      ? artistsFromPeriod(periodMetrics.byArtist)
      : Object.values(pnl.byArtist).map((a) => ({
          name: a.artistName,
          revenue: a.revenue,
          appointments: 0,
          avgValue: 0,
        }));

  const expensesByCategory = Object.entries(pnl.expensesByCategory).map(
    ([key, entry]) => ({
      category: formatCategoryLabel(key),
      total: entry.total,
      topItems: entry.items.slice(0, 3),
    }),
  );

  const tattooService = periodMetrics?.byService?.tattoo ?? monthly?.byService?.tattoo;
  const avgBookingValue = tattooService?.avgValue ?? 0;
  const appointmentCount =
    periodMetrics?.appointmentCount ?? monthly?.appointmentCount ?? 0;

  return {
    period: range.label,
    totalRevenue: pnl.totalRevenue,
    totalExpenses: pnl.totalFixedExpenses,
    artistPayouts: pnl.totalPayroll,
    totalCogs: pnl.totalCogs,
    netProfit: pnl.netProfit,
    marginPercent: pnl.marginPercent,
    appointmentCount,
    avgBookingValue,
    artists,
    expensesByCategory,
    byService: pnl.byService,
  };
}

async function fetchComparisonBundle(
  shopId: string,
  range: QueryDateRange,
  timezone: string,
): Promise<Record<string, unknown>> {
  const current = await fetchFinancialBundle(shopId, range);

  const lastMonthRange = parseDateRange({ period: "last_month" }, timezone);
  const prior = await fetchFinancialBundle(shopId, lastMonthRange);

  const currentRev = Number(current["totalRevenue"] ?? 0);
  const priorRev = Number(prior["totalRevenue"] ?? 0);
  const revenueChangePct =
    priorRev > 0 ? Math.round(((currentRev - priorRev) / priorRev) * 1000) / 10 : null;

  return {
    currentPeriod: current,
    priorPeriod: prior,
    revenueChangePct,
  };
}

async function fetchHealthCheckBundle(
  shopId: string,
  timezone: string,
): Promise<Record<string, unknown>> {
  const ytdYear = new Date().getUTCFullYear();
  const monthRange = parseDateRange({ period: "current_month" }, timezone);
  const yesterdayISO = daysAgoISO(1, timezone);

  const [ytd, monthFinancial, sopSummary] = await Promise.all([
    metricsService.getYtdSummary(shopId, ytdYear),
    fetchFinancialBundle(shopId, monthRange),
    checklistService.getYesterdaySopSummaryText(yesterdayISO),
  ]);

  return {
    ytd,
    currentMonth: monthFinancial,
    sopYesterday: sopSummary || "No SOP completion data for yesterday.",
  };
}

async function fetchArtistBundle(
  shopId: string,
  range: QueryDateRange,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const financial = await fetchFinancialBundle(shopId, range);
  const artists = (financial["artists"] as Array<{ name: string }>) ?? [];
  const artistParam =
    typeof params["artist"] === "string" ? params["artist"].toLowerCase() : "";

  if (artistParam) {
    const match =
      artists.find((a) => a.name.toLowerCase().includes(artistParam)) ?? null;
    return { focusArtist: match, allArtists: artists, period: range.label };
  }

  const metric =
    typeof params["metric"] === "string" ? params["metric"].toLowerCase() : "";
  if (metric.includes("top") || metric.includes("earner")) {
    return {
      rankedArtists: artists,
      period: range.label,
      metric: "top_earner",
    };
  }

  return { artists, period: range.label };
}

async function fetchAppointmentBundle(
  shopId: string,
  range: QueryDateRange,
): Promise<Record<string, unknown>> {
  const financial = await fetchFinancialBundle(shopId, range);
  const period = await metricsService.getWeeklySummary(range.startISO, range.endISO);
  return {
    period: range.label,
    appointmentCount: period.appointmentCount,
    totalRevenue: period.totalRevenue,
    avgBookingValue: financial["avgBookingValue"],
    flags: period.flags,
    byArtist: artistsFromPeriod(period.byArtist),
    byService: period.byService,
  };
}

async function fetchExpenseBundle(
  shopId: string,
  range: QueryDateRange,
): Promise<Record<string, unknown>> {
  const pnl = await pnlService.getPnlSummary(shopId, range.start, range.end);
  const expensesByCategory = Object.entries(pnl.expensesByCategory)
    .map(([key, entry]) => ({
      category: formatCategoryLabel(key),
      total: entry.total,
      items: entry.items,
    }))
    .sort((a, b) => b.total - a.total);

  const top = expensesByCategory[0] ?? null;
  return {
    period: range.label,
    totalExpenses: pnl.totalFixedExpenses,
    totalRevenue: pnl.totalRevenue,
    expensesByCategory,
    topExpense: top,
  };
}

async function fetchSopBundle(timezone: string): Promise<Record<string, unknown>> {
  const yesterdayISO = daysAgoISO(1, timezone);
  const summary = await checklistService.getYesterdaySopSummaryText(yesterdayISO);
  return {
    sessionDate: yesterdayISO,
    summary: summary || "No checklist completions recorded for yesterday.",
  };
}

async function fetchExtraTaskBundle(
  range: QueryDateRange,
): Promise<Record<string, unknown>> {
  return extraTaskService.queryExtraTasksForJarvis(range.start, range.end);
}

async function gatherQueryData(
  shopId: string,
  classified: ClassifiedIntent,
  range: QueryDateRange,
  timezone: string,
): Promise<Record<string, unknown>> {
  const subType = classified.subType ?? "general";
  const params = classified.extractedParams;

  switch (subType) {
    case "financial_recap":
    case "financial_summary":
      return fetchFinancialBundle(shopId, range);
    case "comparison":
      return fetchComparisonBundle(shopId, range, timezone);
    case "health_check":
      return fetchHealthCheckBundle(shopId, timezone);
    case "artist_performance":
      return fetchArtistBundle(shopId, range, params);
    case "expense_query":
      return fetchExpenseBundle(shopId, range);
    case "sop_status":
      return fetchSopBundle(timezone);
    case "extra_task_query":
      return fetchExtraTaskBundle(range);
    case "appointment_query":
      return fetchAppointmentBundle(shopId, range);
    default: {
      const [financial, sop, comparison] = await Promise.all([
        fetchFinancialBundle(shopId, range),
        fetchSopBundle(timezone),
        fetchComparisonBundle(shopId, range, timezone).catch(() => null),
      ]);
      return { financial, sop, comparison };
    }
  }
}

const QUERY_RESPONSE_SYSTEM_PROMPT = `You are JARVIS, the AI operations brain for Fallen Sparrow Tattoo Co.
You speak directly to Legion (the owner) in a sharp, direct, business-savvy tone.
No fluff. No filler phrases like "Great question!" or "Certainly!".
Just the facts, with brief context where it helps Legion make decisions.

ALWAYS format your response as bullet points using the • character.
Every key data point gets its own bullet.
Lead with the most important number or insight.
Flag anything that needs Legion's attention with ⚠️
Flag anything performing well with ✅
Flag anything that needs action with 🔴

Keep it tight. Legion is a busy business owner.
Use USD currency formatting ($X,XXX) when citing money.`;

async function generateQueryResponse(
  queryType: string,
  data: Record<string, unknown>,
  originalInput: string,
  range: QueryDateRange,
): Promise<string> {
  const userMessage = `Legion asked: "${originalInput}"
Query type: ${queryType}
Period: ${range.label} (${range.startISO} to ${range.endISO})
Data (JSON): ${JSON.stringify(data)}

Respond as JARVIS with bullet points covering the key metrics and any flags for attention.
Do not repeat the question. Just give the answer.`;

  const text = await callClaude({
    systemPrompt: QUERY_RESPONSE_SYSTEM_PROMPT,
    userMessage,
    maxTokens: 1000,
  });

  return text.trim() || "• Unable to generate a response right now. Try again in a moment.";
}

export async function handleQuery(
  shopId: string,
  classified: ClassifiedIntent,
  timezone = DEFAULT_TIMEZONE,
): Promise<string> {
  const range = parseDateRange(classified.extractedParams, timezone);
  const data = await gatherQueryData(shopId, classified, range, timezone);
  return generateQueryResponse(
    classified.subType ?? "general",
    data,
    classified.originalInput,
    range,
  );
}
