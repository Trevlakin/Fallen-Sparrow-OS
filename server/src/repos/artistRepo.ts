import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  appointments,
  appointmentPayments,
  artists,
  customers,
  type Artist,
  type NewArtist,
} from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

export async function listActiveArtists(): Promise<Artist[]> {
  return db.select().from(artists).where(eq(artists.isActive, true));
}

export interface ArtistPickerRow {
  id: string;
  name: string;
  isActive: boolean;
}

export async function listArtistsForPicker(): Promise<ArtistPickerRow[]> {
  const rows = await db
    .select({
      id: artists.id,
      name: artists.name,
      isActive: artists.isActive,
    })
    .from(artists)
    .orderBy(asc(artists.name));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    isActive: row.isActive ?? false,
  }));
}

export async function findArtistById(artistId: string): Promise<Artist | undefined> {
  const rows = await db
    .select()
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);
  return rows[0];
}

export interface ArtistAppointmentStats {
  totalAppointments: number;
  completed: number;
  cancelled: number;
  noShow: number;
  totalRevenue: number;
  totalCommission: number;
  customersServed: number;
}

export async function getArtistAppointmentStats(
  artistId: string,
  from: Date,
  to: Date,
): Promise<ArtistAppointmentStats> {
  const statusRows = await db
    .select({
      status: appointments.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, to),
      ),
    )
    .groupBy(appointments.status);

  let totalAppointments = 0;
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  for (const row of statusRows) {
    totalAppointments += row.count;
    if (row.status === "completed") completed = row.count;
    else if (row.status === "cancelled") cancelled = row.count;
    else if (row.status === "no_show") noShow = row.count;
  }

  const paymentRows = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${appointmentPayments.totalRevenue}::numeric), 0)::text`,
      totalCommission: sql<string>`COALESCE(SUM(${appointmentPayments.artistPayout}::numeric), 0)::text`,
    })
    .from(appointmentPayments)
    .where(
      and(
        eq(appointmentPayments.artistId, artistId),
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
      ),
    );

  const customerRows = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${appointments.customerId})::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, to),
      ),
    );

  return {
    totalAppointments,
    completed,
    cancelled,
    noShow,
    totalRevenue: parseDecimal(paymentRows[0]?.totalRevenue),
    totalCommission: parseDecimal(paymentRows[0]?.totalCommission),
    customersServed: customerRows[0]?.count ?? 0,
  };
}

export async function getRepeatCustomerCount(
  artistId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await db
    .select({
      customerId: appointments.customerId,
      visitCount: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, to),
      ),
    )
    .groupBy(appointments.customerId)
    .having(sql`COUNT(*) >= 2`);

  return rows.length;
}

export interface ArtistRecentAppointmentRow {
  appointmentId: string;
  appointmentDate: Date;
  completedDate: Date | null;
  status: string;
  serviceType: string;
  customerId: string | null;
  customerName: string | null;
  totalRevenue: string | null;
}

export async function getArtistRecentAppointments(
  artistId: string,
  limit: number,
): Promise<ArtistRecentAppointmentRow[]> {
  return db
    .select({
      appointmentId: appointments.id,
      appointmentDate: appointments.appointmentDate,
      completedDate: appointments.completedDate,
      status: appointments.status,
      serviceType: appointments.serviceType,
      customerId: appointments.customerId,
      customerName: customers.name,
      totalRevenue: appointmentPayments.totalRevenue,
    })
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .where(eq(appointments.artistId, artistId))
    .orderBy(desc(appointments.appointmentDate))
    .limit(limit);
}

export async function countDistinctBookingDays(
  artistId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`COUNT(DISTINCT DATE(${appointments.appointmentDate}))::int`,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.artistId, artistId),
        eq(appointments.status, "completed"),
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, to),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function findArtistByPorterId(
  porterArtistId: string,
): Promise<Artist | undefined> {
  const rows = await db
    .select()
    .from(artists)
    .where(eq(artists.porterArtistId, porterArtistId))
    .limit(1);
  return rows[0];
}

export async function findArtistByName(name: string): Promise<Artist | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const rows = await db
    .select()
    .from(artists)
    .where(sql`lower(${artists.name}) = lower(${trimmed})`)
    .limit(1);
  return rows[0];
}

export async function createArtist(data: NewArtist): Promise<Artist> {
  const rows = await db.insert(artists).values(data).returning();
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to create artist");
  }
  return created;
}

export async function upsertArtistByPorterId(
  porterArtistId: string,
  data: Omit<NewArtist, "porterArtistId">,
): Promise<Artist> {
  const existing = await findArtistByPorterId(porterArtistId);
  if (existing) {
    const rows = await db
      .update(artists)
      .set({ name: data.name, isActive: data.isActive ?? true })
      .where(eq(artists.id, existing.id))
      .returning();
    const updated = rows[0];
    if (!updated) {
      throw new Error("Failed to update artist");
    }
    return updated;
  }
  return createArtist({ ...data, porterArtistId });
}
