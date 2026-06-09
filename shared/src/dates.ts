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
