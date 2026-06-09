/** Studio calendar day boundary (checklist daily reset, SOP session_date). */
export const STUDIO_TIMEZONE = "America/New_York";

/** YYYY-MM-DD in the given IANA timezone (default Eastern). */
export function getTodayInTimezone(timezone: string = STUDIO_TIMEZONE): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: timezone });
}

/** Checklist "today" for Fallen Sparrow (midnight Eastern, not UTC). */
export function getTodayEastern(): string {
  return getTodayInTimezone(STUDIO_TIMEZONE);
}

/** YYYY-MM-DD in studio timezone from a timestamp (heals UTC session_date mismatches). */
export function getStudioDateFromTimestamp(
  date: Date,
  timezone: string = STUDIO_TIMEZONE,
): string {
  return date.toLocaleDateString("en-CA", { timeZone: timezone });
}
