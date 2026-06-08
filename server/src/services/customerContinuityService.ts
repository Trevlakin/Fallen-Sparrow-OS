/**
 * MASTER_SPEC_v3 §6.2-6.3: customer continuity and friendly nudge candidates.
 */
import { NUDGE_RULES } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as customerRepo from "../repos/customerRepo.js";
import * as nudgeRepo from "../repos/nudgeRepo.js";
import * as paymentRepo from "../repos/paymentRepo.js";
import * as referralRepo from "../repos/referralRepo.js";
import * as settingsService from "./settingsService.js";
import { AppError } from "../utils/errors.js";

export interface TattooHistoryEntry {
  appointmentId: string;
  date: string;
  completedDate: string | null;
  artistId: string | null;
  artistName: string | null;
  serviceType: string;
  status: string;
  notes: string | null;
  totalRevenue: number;
}

export interface CustomerContinuityProfile {
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredArtistId: string | null;
  preferredArtistName: string | null;
  artistsWorkedWith: Array<{ artistId: string; artistName: string }>;
  firstAppointmentDate: string | null;
  lastAppointmentDate: string | null;
  daysSinceLastAppointment: number | null;
  typicalGapDays: number | null;
  isOverdue: boolean;
  totalSpent: number;
  appointmentCount: number;
  tattooHistory: TattooHistoryEntry[];
  referralCount: number;
}

export interface CustomerListItem {
  customerId: string;
  name: string;
  lastAppointmentDate: string | null;
  typicalGapDays: number | null;
  daysSinceLastAppointment: number | null;
  isOverdue: boolean;
}

export interface NudgeCandidate {
  customerId: string;
  name: string;
  lastAppointmentDate: string | null;
  typicalGapDays: number;
  daysSinceLastAppointment: number;
  preferredArtistId: string | null;
  preferredArtistName: string | null;
  suggestedMessage: string;
}

export function calculateTypicalGap(appointmentDates: Date[]): number | null {
  if (appointmentDates.length < 2) {
    return null;
  }
  const sorted = [...appointmentDates].sort((a, b) => a.getTime() - b.getTime());
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (prev && curr) {
      gaps.push(
        Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)),
      );
    }
  }
  if (gaps.length === 0) {
    return null;
  }
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  return gaps[mid] ?? null;
}

export function daysSinceInTimezone(
  from: Date,
  to: Date,
  timezone: string,
): number {
  const fromStr = from.toLocaleDateString("en-CA", { timeZone: timezone });
  const toStr = to.toLocaleDateString("en-CA", { timeZone: timezone });
  const fromDay = new Date(`${fromStr}T12:00:00.000Z`);
  const toDay = new Date(`${toStr}T12:00:00.000Z`);
  return Math.round((toDay.getTime() - fromDay.getTime()) / (1000 * 60 * 60 * 24));
}

export function isCustomerOverdue(
  lastAppointmentDate: Date | null,
  typicalGapDays: number | null,
  timezone: string,
  asOf: Date = new Date(),
): boolean {
  if (!lastAppointmentDate || typicalGapDays === null || typicalGapDays <= 0) {
    return false;
  }
  const daysSince = daysSinceInTimezone(lastAppointmentDate, asOf, timezone);
  return daysSince > typicalGapDays * 1.3;
}

function isNudgeEligible(
  lastAppointmentDate: Date | null,
  typicalGapDays: number | null,
  lastNudgeSentAt: Date | null | undefined,
  timezone: string,
  asOf: Date = new Date(),
): boolean {
  if (!lastAppointmentDate || typicalGapDays === null || typicalGapDays <= 0) {
    return false;
  }
  const daysSince = daysSinceInTimezone(lastAppointmentDate, asOf, timezone);
  if (daysSince <= typicalGapDays + NUDGE_RULES.overdueBufferDays) {
    return false;
  }
  if (daysSince >= typicalGapDays * NUDGE_RULES.maxGapMultiplier) {
    return false;
  }
  if (lastNudgeSentAt) {
    const daysSinceNudge = daysSinceInTimezone(lastNudgeSentAt, asOf, timezone);
    if (daysSinceNudge < NUDGE_RULES.minDaysBetweenNudges) {
      return false;
    }
  }
  return true;
}

function buildWarmNudgeMessage(name: string, artistName: string | null): string {
  const artistLine = artistName
    ? `${artistName} would love to see you for your next piece.`
    : "We would love to see you for your next piece.";
  return `Hi ${name}! It's been a while since your last visit, and ${artistLine} When you're ready, we'd love to get you on the books.`;
}

async function resolveTimezone(shopId: string): Promise<string> {
  const settings = await settingsService.getShopSettings(shopId);
  return settings.timezone || env.DEFAULT_TIMEZONE;
}

async function resolveArtistName(artistId: string | null): Promise<string | null> {
  if (!artistId) {
    return null;
  }
  const artist = await artistRepo.findArtistById(artistId);
  return artist?.name ?? null;
}

export async function recomputeCustomerStats(customerId: string): Promise<void> {
  const rows = await paymentRepo.listCompletedAppointmentsByCustomer(customerId);
  const dates = rows
    .map((r) => r.appointmentDate)
    .filter((d): d is Date => d instanceof Date);

  let total = 0;
  for (const row of rows) {
    if (row.totalRevenue) {
      total += Number.parseFloat(row.totalRevenue);
    }
  }

  const first =
    dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
  const last =
    dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

  await customerRepo.updateCustomerCachedStats(customerId, {
    totalSpent: total.toFixed(2),
    appointmentCount: dates.length,
    firstAppointmentDate: first,
    lastAppointmentDate: last,
    typicalGapDays: calculateTypicalGap(dates),
  });
}

export async function getCustomerContinuityProfile(
  customerId: string,
  shopId: string,
): Promise<CustomerContinuityProfile> {
  const customer = await customerRepo.findCustomerById(customerId);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const timezone = await resolveTimezone(shopId);
  const [history, referralCount] = await Promise.all([
    customerRepo.getCustomerAppointmentHistory(customerId),
    referralRepo.getReferralCountForCustomer(customerId),
  ]);

  const artistMap = new Map<string, string>();
  for (const row of history) {
    if (row.artistId && row.artistName) {
      artistMap.set(row.artistId, row.artistName);
    }
  }

  const preferredArtistName = customer.preferredArtistId
    ? (artistMap.get(customer.preferredArtistId) ??
      (await resolveArtistName(customer.preferredArtistId)))
    : null;

  const daysSinceLast = customer.lastAppointmentDate
    ? daysSinceInTimezone(customer.lastAppointmentDate, new Date(), timezone)
    : null;

  return {
    customerId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    preferredArtistId: customer.preferredArtistId,
    preferredArtistName,
    artistsWorkedWith: [...artistMap.entries()].map(([artistId, artistName]) => ({
      artistId,
      artistName,
    })),
    firstAppointmentDate: customer.firstAppointmentDate?.toISOString() ?? null,
    lastAppointmentDate: customer.lastAppointmentDate?.toISOString() ?? null,
    daysSinceLastAppointment: daysSinceLast,
    typicalGapDays: customer.typicalGapDays,
    isOverdue: isCustomerOverdue(
      customer.lastAppointmentDate,
      customer.typicalGapDays,
      timezone,
    ),
    totalSpent: customer.totalSpent ? Number.parseFloat(customer.totalSpent) : 0,
    appointmentCount: customer.appointmentCount ?? 0,
    tattooHistory: history.map((row) => ({
      appointmentId: row.appointmentId,
      date: row.appointmentDate.toISOString(),
      completedDate: row.completedDate?.toISOString() ?? null,
      artistId: row.artistId,
      artistName: row.artistName,
      serviceType: row.serviceType,
      status: row.status,
      notes: row.notes,
      totalRevenue: row.totalRevenue ? Number.parseFloat(row.totalRevenue) : 0,
    })),
    referralCount,
  };
}

export async function listCustomerSummaries(
  shopId: string,
): Promise<CustomerListItem[]> {
  const timezone = await resolveTimezone(shopId);
  const rows = await customerRepo.getCustomersForContinuityRaw();

  return rows.map((row) => {
    const daysSinceLast = row.lastAppointmentDate
      ? daysSinceInTimezone(row.lastAppointmentDate, new Date(), timezone)
      : null;
    return {
      customerId: row.id,
      name: row.name,
      lastAppointmentDate: row.lastAppointmentDate?.toISOString() ?? null,
      typicalGapDays: row.typicalGapDays,
      daysSinceLastAppointment: daysSinceLast,
      isOverdue: isCustomerOverdue(
        row.lastAppointmentDate,
        row.typicalGapDays,
        timezone,
      ),
    };
  });
}

export async function getNudgeCandidates(shopId: string): Promise<NudgeCandidate[]> {
  const timezone = await resolveTimezone(shopId);
  const rows = await customerRepo.getCustomersForContinuityRaw();
  const candidates: NudgeCandidate[] = [];

  for (const row of rows) {
    const latestNudge = await nudgeRepo.getLatestNudgeForCustomer(row.id);
    if (
      !isNudgeEligible(
        row.lastAppointmentDate,
        row.typicalGapDays,
        latestNudge?.sentAt ?? undefined,
        timezone,
      )
    ) {
      continue;
    }

    const typicalGapDays = row.typicalGapDays as number;
    const daysSinceLast = daysSinceInTimezone(
      row.lastAppointmentDate as Date,
      new Date(),
      timezone,
    );
    const preferredArtistName = await resolveArtistName(row.preferredArtistId);

    candidates.push({
      customerId: row.id,
      name: row.name,
      lastAppointmentDate: row.lastAppointmentDate?.toISOString() ?? null,
      typicalGapDays,
      daysSinceLastAppointment: daysSinceLast,
      preferredArtistId: row.preferredArtistId,
      preferredArtistName,
      suggestedMessage: buildWarmNudgeMessage(row.name, preferredArtistName),
    });
  }

  return candidates.sort(
    (a, b) => b.daysSinceLastAppointment - a.daysSinceLastAppointment,
  );
}
