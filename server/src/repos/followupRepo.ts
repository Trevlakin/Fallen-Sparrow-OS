import { and, eq, gte, lte, or } from "drizzle-orm";
import { clientFollowups, artists } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export interface FollowupRow {
  id: string;
  clientName: string;
  clientPhone: string | null;
  artistId: string | null;
  artistName: string | null;
  appointmentDate: string;
  followupType: string;
  dueDate: string;
  contactedAt: string | null;
  contactNotes: string | null;
  closed: boolean;
  createdAt: string;
  daysOverdue: number | null;
}

function toRow(
  row: typeof clientFollowups.$inferSelect & { artistName?: string | null },
): FollowupRow {
  const today = new Date().toISOString().split("T")[0]!;
  const due = row.dueDate;
  const daysOverdue = due < today
    ? Math.floor((Date.now() - new Date(due).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    id: row.id,
    clientName: row.clientName,
    clientPhone: row.clientPhone ?? null,
    artistId: row.artistId ?? null,
    artistName: row.artistName ?? null,
    appointmentDate: row.appointmentDate,
    followupType: row.followupType,
    dueDate: row.dueDate,
    contactedAt: row.contactedAt?.toISOString() ?? null,
    contactNotes: row.contactNotes ?? null,
    closed: row.closed,
    createdAt: row.createdAt.toISOString(),
    daysOverdue,
  };
}

export async function listDueToday(todayISO: string): Promise<FollowupRow[]> {
  const rows = await db
    .select({
      id: clientFollowups.id,
      clientName: clientFollowups.clientName,
      clientPhone: clientFollowups.clientPhone,
      artistId: clientFollowups.artistId,
      artistName: artists.name,
      appointmentDate: clientFollowups.appointmentDate,
      followupType: clientFollowups.followupType,
      dueDate: clientFollowups.dueDate,
      contactedAt: clientFollowups.contactedAt,
      contactNotes: clientFollowups.contactNotes,
      closed: clientFollowups.closed,
      createdAt: clientFollowups.createdAt,
    })
    .from(clientFollowups)
    .leftJoin(artists, eq(clientFollowups.artistId, artists.id))
    .where(
      and(
        lte(clientFollowups.dueDate, todayISO),
        eq(clientFollowups.closed, false),
      ),
    )
    .orderBy(clientFollowups.dueDate);

  return rows.map((r) => toRow({ ...r, artistName: r.artistName ?? null }));
}

export async function listUpcoming(
  afterISO: string,
  beforeISO: string,
): Promise<FollowupRow[]> {
  const rows = await db
    .select({
      id: clientFollowups.id,
      clientName: clientFollowups.clientName,
      clientPhone: clientFollowups.clientPhone,
      artistId: clientFollowups.artistId,
      artistName: artists.name,
      appointmentDate: clientFollowups.appointmentDate,
      followupType: clientFollowups.followupType,
      dueDate: clientFollowups.dueDate,
      contactedAt: clientFollowups.contactedAt,
      contactNotes: clientFollowups.contactNotes,
      closed: clientFollowups.closed,
      createdAt: clientFollowups.createdAt,
    })
    .from(clientFollowups)
    .leftJoin(artists, eq(clientFollowups.artistId, artists.id))
    .where(
      and(
        gte(clientFollowups.dueDate, afterISO),
        lte(clientFollowups.dueDate, beforeISO),
        eq(clientFollowups.closed, false),
      ),
    )
    .orderBy(clientFollowups.dueDate);

  return rows.map((r) => toRow({ ...r, artistName: r.artistName ?? null }));
}

export async function findById(id: string): Promise<FollowupRow | null> {
  const rows = await db
    .select({
      id: clientFollowups.id,
      clientName: clientFollowups.clientName,
      clientPhone: clientFollowups.clientPhone,
      artistId: clientFollowups.artistId,
      artistName: artists.name,
      appointmentDate: clientFollowups.appointmentDate,
      followupType: clientFollowups.followupType,
      dueDate: clientFollowups.dueDate,
      contactedAt: clientFollowups.contactedAt,
      contactNotes: clientFollowups.contactNotes,
      closed: clientFollowups.closed,
      createdAt: clientFollowups.createdAt,
    })
    .from(clientFollowups)
    .leftJoin(artists, eq(clientFollowups.artistId, artists.id))
    .where(eq(clientFollowups.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;
  return toRow({ ...r, artistName: r.artistName ?? null });
}

const FOLLOWUP_INTERVALS: {
  type: "2_week" | "1_month" | "2_month" | "6_month";
  days: number;
}[] = [
  { type: "2_week", days: 14 },
  { type: "1_month", days: 30 },
  { type: "2_month", days: 60 },
  { type: "6_month", days: 180 },
];

export async function scheduleFollowUps(params: {
  clientName: string;
  clientPhone?: string;
  artistId?: string;
  appointmentDate: Date;
}): Promise<void> {
  const base = params.appointmentDate;
  const appointmentDateStr = base.toISOString().split("T")[0]!;

  const existing = await db
    .select({ followupType: clientFollowups.followupType })
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.clientName, params.clientName),
        eq(clientFollowups.appointmentDate, appointmentDateStr),
      ),
    );

  const existingTypes = new Set(existing.map((row) => row.followupType));

  const toInsert = FOLLOWUP_INTERVALS.filter((i) => !existingTypes.has(i.type)).map(
    (i) => {
      const dueDate = new Date(base);
      dueDate.setDate(dueDate.getDate() + i.days);
      return {
        clientName: params.clientName,
        clientPhone: params.clientPhone ?? null,
        artistId: params.artistId ?? null,
        appointmentDate: appointmentDateStr,
        followupType: i.type,
        dueDate: dueDate.toISOString().split("T")[0]!,
      };
    },
  );

  if (toInsert.length === 0) return;

  await db.insert(clientFollowups).values(toInsert);
}

export async function logContact(
  id: string,
  notes: string,
): Promise<void> {
  await db
    .update(clientFollowups)
    .set({
      contactedAt: new Date(),
      contactNotes: notes,
    })
    .where(eq(clientFollowups.id, id));
}

export async function closeFollowup(id: string): Promise<void> {
  await db
    .update(clientFollowups)
    .set({ closed: true, contactedAt: new Date() })
    .where(eq(clientFollowups.id, id));
}
