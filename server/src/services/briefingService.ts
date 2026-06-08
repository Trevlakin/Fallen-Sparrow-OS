/**
 * MASTER_SPEC_v3 §7 — Briefing orchestration (snapshot, synthesis, delivery).
 */
import { env, hasBriefingRecipient as envHasBriefingRecipient } from "../config/env.js";
import * as briefingRepo from "../repos/briefingRepo.js";
import * as emailService from "./emailService.js";
import * as briefingSynthesisService from "./briefingSynthesisService.js";
import type { BriefingPeriod } from "./briefingSynthesisService.js";
import {
  addDaysToISO,
  endOfDayUTC,
  startOfDayUTC,
  todayISOInTimezone,
} from "../lib/timezone.js";
import { AppError } from "../utils/errors.js";

export function hasBriefingRecipient(): boolean {
  return envHasBriefingRecipient();
}

function previousMonth(timezone: string): { year: number; month: number } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  if (month === 1) {
    return { year: year - 1, month: 12 };
  }
  return { year, month: month - 1 };
}

function briefingRecipient(): string {
  const email = env.BRIEFING_RECIPIENT_EMAIL;
  if (!email) {
    throw new AppError("BRIEFING_RECIPIENT_EMAIL is not configured", 503);
  }
  return email;
}

async function deliverBriefing(
  briefingId: string,
  snapshot: briefingSynthesisService.BriefingDataSnapshot,
  narrative: string,
): Promise<boolean> {
  if (!hasBriefingRecipient()) {
    return false;
  }

  const subject =
    snapshot.period === "daily"
      ? `Daily briefing: ${snapshot.dateLabel}`
      : snapshot.period === "weekly"
        ? `Weekly briefing: ${snapshot.dateLabel}`
        : `Monthly briefing: ${snapshot.dateLabel}`;

  const sent = await emailService.sendBriefingEmail({
    to: briefingRecipient(),
    subject,
    periodLabel: snapshot.dateLabel,
    narrative,
  });

  if (sent) {
    await briefingRepo.markBriefingDelivered(briefingId, "email");
  }
  return sent;
}

export async function runDailyBriefing(
  shopId: string,
  dateISO: string,
  timezone: string,
): Promise<{ briefingId: string; delivered: boolean }> {
  const snapshot = await briefingSynthesisService.assembleDailySnapshot(
    shopId,
    dateISO,
    timezone,
  );
  const periodStart = startOfDayUTC(dateISO);
  const periodEnd = endOfDayUTC(dateISO);
  const { narrativeText, briefingId } =
    await briefingSynthesisService.synthesizeBriefing(
      snapshot,
      periodStart,
      periodEnd,
    );
  const delivered = await deliverBriefing(briefingId, snapshot, narrativeText);
  return { briefingId, delivered };
}

export async function runWeeklyBriefing(
  shopId: string,
  startISO: string,
  endISO: string,
  timezone: string,
): Promise<{ briefingId: string; delivered: boolean }> {
  const snapshot = await briefingSynthesisService.assembleWeeklySnapshot(
    shopId,
    startISO,
    endISO,
    timezone,
  );
  const periodStart = new Date(`${startISO}T00:00:00.000Z`);
  const periodEnd = new Date(`${endISO}T23:59:59.999Z`);
  const { narrativeText, briefingId } =
    await briefingSynthesisService.synthesizeBriefing(
      snapshot,
      periodStart,
      periodEnd,
    );
  const delivered = await deliverBriefing(briefingId, snapshot, narrativeText);
  return { briefingId, delivered };
}

export async function runMonthlyBriefing(
  shopId: string,
  year: number,
  month: number,
  timezone: string,
): Promise<{ briefingId: string; delivered: boolean }> {
  const snapshot = await briefingSynthesisService.assembleMonthlySnapshot(
    shopId,
    year,
    month,
    timezone,
  );
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const { narrativeText, briefingId } =
    await briefingSynthesisService.synthesizeBriefing(
      snapshot,
      periodStart,
      periodEnd,
    );
  const delivered = await deliverBriefing(briefingId, snapshot, narrativeText);
  return { briefingId, delivered };
}

export async function generateBriefing(
  shopId: string,
  period: BriefingPeriod,
  timezone: string,
  options?: { dateISO?: string; startISO?: string; endISO?: string; year?: number; month?: number },
): Promise<{
  briefingId: string;
  narrative: string;
  snapshot: briefingSynthesisService.BriefingDataSnapshot;
  delivered: boolean;
}> {
  let snapshot: briefingSynthesisService.BriefingDataSnapshot;
  let periodStart: Date;
  let periodEnd: Date;

  if (period === "daily") {
    const dateISO = options?.dateISO ?? todayISOInTimezone(timezone);
    snapshot = await briefingSynthesisService.assembleDailySnapshot(
      shopId,
      dateISO,
      timezone,
    );
    periodStart = startOfDayUTC(dateISO);
    periodEnd = endOfDayUTC(dateISO);
  } else if (period === "weekly") {
    const endISO = options?.endISO ?? todayISOInTimezone(timezone);
    const startISO = options?.startISO ?? addDaysToISO(endISO, -6);
    snapshot = await briefingSynthesisService.assembleWeeklySnapshot(
      shopId,
      startISO,
      endISO,
      timezone,
    );
    periodStart = startOfDayUTC(startISO);
    periodEnd = endOfDayUTC(endISO);
  } else {
    const defaults = previousMonth(timezone);
    const year = options?.year ?? defaults.year;
    const month = options?.month ?? defaults.month;
    snapshot = await briefingSynthesisService.assembleMonthlySnapshot(
      shopId,
      year,
      month,
      timezone,
    );
    periodStart = new Date(Date.UTC(year, month - 1, 1));
    periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  }

  const { narrativeText, briefingId } =
    await briefingSynthesisService.synthesizeBriefing(
      snapshot,
      periodStart,
      periodEnd,
    );
  const delivered = await deliverBriefing(briefingId, snapshot, narrativeText);

  return {
    briefingId,
    narrative: narrativeText,
    snapshot,
    delivered,
  };
}

export async function getLatestBriefing(briefingType?: string) {
  const row = await briefingRepo.findLatestBriefing(briefingType);
  if (!row) {
    throw new AppError("No briefings found", 404);
  }
  return row;
}

export async function getBriefingHistory(limit = 30, briefingType?: string) {
  return briefingRepo.listBriefingHistory(limit, briefingType);
}
