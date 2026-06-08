import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import { formatDateInTimezone } from "../lib/timezone.js";
import * as sopHistoryRepo from "../repos/sopHistoryRepo.js";

export interface SopHistoryEntry {
  date: string;
  employee: string;
  sopName: string;
  completedCount: number;
  totalCount: number;
  status: "complete" | "partial";
  completedAt: string | null;
  missedItems: string[];
}

function todayISO(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

export async function getHistoryByRole(
  role: TeamMemberRole,
  daysBack: number,
  timezone = env.DEFAULT_TIMEZONE,
): Promise<SopHistoryEntry[]> {
  const rows = await sopHistoryRepo.getHistoryByRole(
    role,
    daysBack,
    todayISO(timezone),
  );

  return rows.map((row) => ({
    date: row.sessionDate,
    employee: row.employee,
    sopName: row.sopName,
    completedCount: row.completedCount,
    totalCount: row.totalCount,
    status:
      row.totalCount > 0 && row.completedCount >= row.totalCount
        ? "complete"
        : "partial",
    completedAt: row.lastCompletedAt?.toISOString() ?? null,
    missedItems: row.missedItemLabels,
  }));
}
