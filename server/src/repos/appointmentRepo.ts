import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import {
  appointmentPayments,
  appointments,
  artists,
  customers,
  type Appointment,
  type NewAppointment,
} from "@fallen-sparrow/shared/schema";
import type { SchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

type AppointmentRow = Appointment;

export async function findAppointmentByPorterId(
  porterAppointmentId: string,
): Promise<AppointmentRow | undefined> {
  const rows = await db
    .select()
    .from(appointments)
    .where(eq(appointments.porterAppointmentId, porterAppointmentId))
    .limit(1);
  return rows[0];
}

export async function upsertAppointment(
  porterAppointmentId: string,
  data: NewAppointment,
): Promise<AppointmentRow> {
  const existing = await findAppointmentByPorterId(porterAppointmentId);
  if (existing) {
    const rows = await db
      .update(appointments)
      .set({
        customerId: data.customerId,
        artistId: data.artistId,
        serviceType: data.serviceType,
        status: data.status,
        appointmentDate: data.appointmentDate,
        completedDate: data.completedDate,
        depositCollected: data.depositCollected,
        notes: data.notes,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, existing.id))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Failed to update appointment");
    return updated;
  }
  const rows = await db
    .insert(appointments)
    .values({ ...data, porterAppointmentId })
    .returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create appointment");
  return created;
}

export interface AppointmentListRow {
  id: string;
  serviceType: string;
  artistId: string | null;
  artistName: string | null;
  customerId: string | null;
  customerName: string | null;
  totalRevenue: number;
  artistPayout: number;
  appointmentDate: Date;
}

export async function listAppointments(params: {
  search?: string;
  page: number;
  limit: number;
  from?: Date;
  to?: Date;
}): Promise<{ rows: AppointmentListRow[]; total: number }> {
  const limit = Math.min(Math.max(params.limit, 1), 100);
  const page = Math.max(params.page, 1);
  const offset = (page - 1) * limit;

  const conditions = [];
  if (params.from) {
    conditions.push(gte(appointments.appointmentDate, params.from));
  }
  if (params.to) {
    conditions.push(lte(appointments.appointmentDate, params.to));
  }
  if (params.search?.trim()) {
    const pattern = `%${params.search.trim()}%`;
    conditions.push(
      or(
        ilike(sql`${appointments.serviceType}::text`, pattern),
        ilike(customers.name, pattern),
        ilike(artists.name, pattern),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const baseQuery = db
    .select({
      id: appointments.id,
      serviceType: appointments.serviceType,
      artistId: appointments.artistId,
      artistName: artists.name,
      customerId: appointments.customerId,
      customerName: customers.name,
      totalRevenue: appointmentPayments.totalRevenue,
      artistPayout: appointmentPayments.artistPayout,
      appointmentDate: appointments.appointmentDate,
    })
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(artists, eq(artists.id, appointments.artistId))
    .leftJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    );

  const countRows = await db
    .select({ total: count() })
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(artists, eq(artists.id, appointments.artistId))
    .where(whereClause);

  const total = Number(countRows[0]?.total ?? 0);

  const rows = await (whereClause ? baseQuery.where(whereClause) : baseQuery)
    .orderBy(desc(appointments.appointmentDate))
    .limit(limit)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      id: row.id,
      serviceType: row.serviceType,
      artistId: row.artistId,
      artistName: row.artistName,
      customerId: row.customerId,
      customerName: row.customerName,
      totalRevenue: parseDecimal(row.totalRevenue),
      artistPayout: parseDecimal(row.artistPayout),
      appointmentDate: row.appointmentDate,
    })),
    total,
  };
}

export interface TodayAppointmentRow {
  artistId: string | null;
  artistName: string | null;
  serviceType: string;
  appointmentDate: Date;
  customerName: string | null;
}

export async function listTodaysAppointments(
  from: Date,
  to: Date,
  limit = 10,
): Promise<TodayAppointmentRow[]> {
  const rows = await db
    .select({
      artistId: appointments.artistId,
      artistName: artists.name,
      serviceType: appointments.serviceType,
      appointmentDate: appointments.appointmentDate,
      customerName: customers.name,
    })
    .from(appointments)
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .leftJoin(artists, eq(artists.id, appointments.artistId))
    .where(
      and(
        gte(appointments.appointmentDate, from),
        lte(appointments.appointmentDate, to),
      ),
    )
    .orderBy(asc(appointments.appointmentDate))
    .limit(limit);

  return rows.map((row) => ({
    artistId: row.artistId,
    artistName: row.artistName,
    serviceType: row.serviceType,
    appointmentDate: row.appointmentDate,
    customerName: row.customerName,
  }));
}

export type { AppointmentRow as Appointment };

export interface HistoricalImportMatch {
  id: string;
  serviceType: string;
}

export async function findHistoricalImportMatch(params: {
  artistName: string;
  clientName: string;
  appointmentDate: Date;
  totalRevenue: number;
}): Promise<HistoricalImportMatch | undefined> {
  const revenueStr = params.totalRevenue.toFixed(2);
  const dayStart = new Date(params.appointmentDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(params.appointmentDate);
  dayEnd.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: appointments.id,
      serviceType: appointments.serviceType,
    })
    .from(appointments)
    .innerJoin(artists, eq(appointments.artistId, artists.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .innerJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .where(
      and(
        ilike(artists.name, params.artistName.trim()),
        ilike(customers.name, params.clientName.trim()),
        gte(appointments.appointmentDate, dayStart),
        lte(appointments.appointmentDate, dayEnd),
        eq(appointmentPayments.totalRevenue, revenueStr),
        sql`${appointments.porterAppointmentId} LIKE 'historical-%'`,
      ),
    )
    .limit(1);

  return rows[0];
}

export async function findAppointmentByArtistClientDate(params: {
  artistName: string;
  clientName: string;
  appointmentDate: Date;
}): Promise<{ id: string } | undefined> {
  const windowStart = new Date(params.appointmentDate);
  windowStart.setSeconds(0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setMinutes(windowEnd.getMinutes() + 1);

  const rows = await db
    .select({ id: appointments.id })
    .from(appointments)
    .innerJoin(artists, eq(appointments.artistId, artists.id))
    .innerJoin(customers, eq(appointments.customerId, customers.id))
    .where(
      and(
        ilike(artists.name, params.artistName.trim()),
        ilike(customers.name, params.clientName.trim()),
        gte(appointments.appointmentDate, windowStart),
        lt(appointments.appointmentDate, windowEnd),
      ),
    )
    .limit(1);

  return rows[0];
}

export async function updateAppointmentServiceType(
  appointmentId: string,
  serviceType: SchemaServiceType,
): Promise<void> {
  await db
    .update(appointments)
    .set({ serviceType, updatedAt: new Date() })
    .where(eq(appointments.id, appointmentId));
}
