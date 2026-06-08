import * as followupRepo from "../repos/followupRepo.js";
import { AppError } from "../utils/errors.js";
import { todayISOInTimezone } from "../lib/timezone.js";

const DEFAULT_TZ = "America/New_York";

export async function getDueToday(timezone = DEFAULT_TZ) {
  const todayISO = todayISOInTimezone(timezone);
  return followupRepo.listDueToday(todayISO);
}

export async function getUpcomingWeek(timezone = DEFAULT_TZ) {
  const todayISO = todayISOInTimezone(timezone);
  const sevenDays = new Date(todayISO);
  sevenDays.setDate(sevenDays.getDate() + 7);
  const weekISO = sevenDays.toISOString().split("T")[0]!;
  return followupRepo.listUpcoming(todayISO, weekISO);
}

export async function logContact(id: string, notes: string): Promise<void> {
  const row = await followupRepo.findById(id);
  if (!row) throw new AppError("Follow-up not found", 404);
  await followupRepo.logContact(id, notes);
}

export async function closeFollowup(id: string): Promise<void> {
  const row = await followupRepo.findById(id);
  if (!row) throw new AppError("Follow-up not found", 404);
  await followupRepo.closeFollowup(id);
}

export async function scheduleFollowUps(params: {
  clientName: string;
  clientPhone?: string;
  artistId?: string;
  appointmentDate: Date;
}): Promise<void> {
  return followupRepo.scheduleFollowUps(params);
}

/** Schedule the 4-pack when a completed sale/appointment is recorded (idempotent). */
export async function scheduleFollowUpsForCompletedAppointment(params: {
  clientName: string;
  clientPhone?: string | null;
  artistId?: string;
  appointmentDate: Date;
}): Promise<void> {
  const name = params.clientName.trim();
  if (!name) return;

  await followupRepo.scheduleFollowUps({
    clientName: name,
    clientPhone: params.clientPhone ?? undefined,
    artistId: params.artistId,
    appointmentDate: params.appointmentDate,
  });
}
