/**
 * MASTER_SPEC_v3 §7.1 — Scheduled briefing jobs (daily, weekly, monthly).
 */
import cron from "node-cron";
import { env, hasBriefingRecipient } from "../config/env.js";
import { DEFAULT_STUDIO_ID } from "../middleware/tenantEnforcement.js";
import * as briefingService from "../services/briefingService.js";
import {
  addDaysToISO,
  todayISOInTimezone,
} from "../lib/timezone.js";
import { logger } from "../utils/logger.js";

function getShopId(): string {
  return DEFAULT_STUDIO_ID;
}

function yesterdayISO(timezone: string): string {
  const today = todayISOInTimezone(timezone);
  return addDaysToISO(today, -1);
}

function lastSevenDaysEndingToday(timezone: string): { startISO: string; endISO: string } {
  const endISO = todayISOInTimezone(timezone);
  const startISO = addDaysToISO(endISO, -6);
  return { startISO, endISO };
}

function previousMonthInTimezone(timezone: string): { year: number; month: number } {
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

async function runDailyJob(): Promise<void> {
  if (!hasBriefingRecipient()) {
    logger.warn("Daily briefing skipped: BRIEFING_RECIPIENT_EMAIL not set");
    return;
  }
  const shopId = getShopId();
  const tz = env.DEFAULT_TIMEZONE;
  const dateISO = yesterdayISO(tz);
  const result = await briefingService.runDailyBriefing(shopId, dateISO, tz);
  logger.info("Daily briefing job completed", result);
}

async function runWeeklyJob(): Promise<void> {
  if (!hasBriefingRecipient()) {
    logger.warn("Weekly briefing skipped: BRIEFING_RECIPIENT_EMAIL not set");
    return;
  }
  const shopId = getShopId();
  const tz = env.DEFAULT_TIMEZONE;
  const { startISO, endISO } = lastSevenDaysEndingToday(tz);
  const result = await briefingService.runWeeklyBriefing(
    shopId,
    startISO,
    endISO,
    tz,
  );
  logger.info("Weekly briefing job completed", result);
}

async function runMonthlyJob(): Promise<void> {
  if (!hasBriefingRecipient()) {
    logger.warn("Monthly briefing skipped: BRIEFING_RECIPIENT_EMAIL not set");
    return;
  }
  const shopId = getShopId();
  const tz = env.DEFAULT_TIMEZONE;
  const { year, month } = previousMonthInTimezone(tz);
  const result = await briefingService.runMonthlyBriefing(shopId, year, month, tz);
  logger.info("Monthly briefing job completed", { year, month, ...result });
}

function wrapJob(name: string, fn: () => Promise<void>): () => void {
  return () => {
    void fn().catch((err) => {
      logger.error(`${name} briefing job failed`, {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };
}

export function startBriefingJobs(): void {
  const tz = env.DEFAULT_TIMEZONE;

  cron.schedule(
    `0 ${env.BRIEFING_SEND_HOUR} * * *`,
    wrapJob("Daily", runDailyJob),
    { timezone: tz },
  );

  cron.schedule(
    `0 ${env.WEEKLY_REPORT_HOUR} * * ${env.WEEKLY_REPORT_DAY}`,
    wrapJob("Weekly", runWeeklyJob),
    { timezone: tz },
  );

  cron.schedule("0 7 1 * *", wrapJob("Monthly", runMonthlyJob), {
    timezone: tz,
  });

  logger.info("Briefing cron jobs scheduled", {
    timezone: tz,
    dailyHour: env.BRIEFING_SEND_HOUR,
    weeklyDay: env.WEEKLY_REPORT_DAY,
    weeklyHour: env.WEEKLY_REPORT_HOUR,
    monthly: "1st at 07:00 (previous month)",
  });
}
