/** Studio calendar day boundary (checklist daily reset, SOP session_date). */
export const STUDIO_TIMEZONE = "America/New_York";

/**
 * Studio day cutoff. Work logged between midnight and this hour (Eastern)
 * counts toward the PREVIOUS studio day, so a closing checklist finished at
 * 12:30 AM still belongs to the shift that just ended. The new studio day
 * starts at 4 AM Eastern.
 */
export const STUDIO_DAY_CUTOFF_HOUR = 4;

/** YYYY-MM-DD in the given IANA timezone (default Eastern). Pure calendar date, no cutoff. */
export function getTodayInTimezone(timezone: string = STUDIO_TIMEZONE): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Calendar "today" in Eastern (no studio-day cutoff). */
export function getTodayEastern(): string {
  return getTodayInTimezone(STUDIO_TIMEZONE);
}

/**
 * Studio day (YYYY-MM-DD) for a timestamp: the calendar date in studio
 * timezone, shifted back by STUDIO_DAY_CUTOFF_HOUR. This is THE function for
 * checklist/extra-task session dates. Server and web must both use it.
 */
export function getStudioDay(
  at: Date = new Date(),
  timezone: string = STUDIO_TIMEZONE,
): string {
  const shifted = new Date(
    at.getTime() - STUDIO_DAY_CUTOFF_HOUR * 60 * 60 * 1000,
  );
  return shifted.toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Studio day for a stored completion timestamp (heals misfiled session_date rows). */
export function getStudioDateFromTimestamp(
  date: Date,
  timezone: string = STUDIO_TIMEZONE,
): string {
  return getStudioDay(date, timezone);
}

/** Convert wall-clock date/time in a timezone to a UTC Date. */
export function wallTimeInTimeZoneToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string = STUDIO_TIMEZONE,
): Date {
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = formatter.formatToParts(new Date(utcMs));
    const read = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((p) => p.type === type)?.value ?? "0");
    let y = read("year");
    let mo = read("month");
    let d = read("day");
    let h = read("hour");
    const min = read("minute");
    if (h === 24) {
      h = 0;
    }

    const diffMinutes =
      (year - y) * 525_600 +
      (month - mo) * 43_200 +
      (day - d) * 1_440 +
      (hour - h) * 60 +
      (minute - min);

    if (diffMinutes === 0) {
      break;
    }
    utcMs += diffMinutes * 60 * 1000;
  }

  return new Date(utcMs);
}

/**
 * Porter Appointment Transactions date: MM/DD/YY HH:MM AM/PM in Eastern time.
 * Example: 06/09/26 12:00 PM
 */
export function parsePorterAppointmentDateTime(
  raw: string,
  timeZone: string = STUDIO_TIMEZONE,
): Date | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const porterMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (porterMatch) {
    const month = Number(porterMatch[1]);
    const day = Number(porterMatch[2]);
    let year = Number(porterMatch[3]);
    if (year < 100) {
      year += 2000;
    }
    let hour = Number(porterMatch[4]);
    const minute = Number(porterMatch[5]);
    const ampm = porterMatch[6]?.toUpperCase();
    if (ampm === "PM" && hour !== 12) {
      hour += 12;
    }
    if (ampm === "AM" && hour === 12) {
      hour = 0;
    }
    return wallTimeInTimeZoneToUtc(year, month, day, hour, minute, timeZone);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const mdy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    return wallTimeInTimeZoneToUtc(year, month, day, 12, 0, timeZone);
  }

  return null;
}
