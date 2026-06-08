/**
 * Shop-local calendar dates (America/New_York default). Avoid setDate() on raw Date
 * without timeZone; use ISO strings + noon UTC anchors for day arithmetic.
 */

export function formatDateInTimezone(date: Date, timezone: string): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}

export function todayISOInTimezone(timezone: string): string {
  return formatDateInTimezone(new Date(), timezone);
}

export function addDaysToISO(iso: string, days: number): string {
  const base = new Date(`${iso}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function daysAgoISO(
  days: number,
  timezone: string,
  anchorISO?: string,
): string {
  const base = anchorISO ?? todayISOInTimezone(timezone);
  return addDaysToISO(base, -days);
}

export function startOfDayUTC(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

export function endOfDayUTC(iso: string): Date {
  return new Date(`${iso}T23:59:59.999Z`);
}

export function weekdayLabelInTimezone(iso: string, timezone: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });
}

export function dateLabelInTimezone(iso: string, timezone: string): string {
  return new Date(`${iso}T12:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  });
}

export function monthBoundsForYearMonth(
  year: number,
  month: number,
): { monthKey: string; from: Date; to: Date } {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const startISO = `${monthKey}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endISO = `${monthKey}-${String(lastDay).padStart(2, "0")}`;
  return {
    monthKey,
    from: startOfDayUTC(startISO),
    to: endOfDayUTC(endISO),
  };
}

export function buildDateReferenceBlock(timezone: string): {
  todayISO: string;
  block: string;
} {
  const now = new Date();
  const todayISO = now.toLocaleDateString("en-CA", { timeZone: timezone });
  const dayOfWeek = now.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: timezone,
  });

  const days: string[] = [];
  for (let i = 0; i <= 7; i++) {
    const iso = addDaysToISO(todayISO, -i);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Yesterday"
          : weekdayLabelInTimezone(iso, timezone);
    days.push(`- ${label}: ${iso}`);
  }

  return {
    todayISO,
    block: `TODAY: ${todayISO} (${dayOfWeek})\nDATE REFERENCE (use these, do not compute dates yourself):\n${days.join("\n")}`,
  };
}
