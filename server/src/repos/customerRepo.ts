import { asc, desc, eq, sql } from "drizzle-orm";
import {
  appointments,
  appointmentPayments,
  artists,
  customers,
  type Customer,
  type NewCustomer,
} from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

type CustomerRow = Customer;

export async function findCustomerByPorterId(
  porterClientId: string,
): Promise<CustomerRow | undefined> {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.porterClientId, porterClientId))
    .limit(1);
  return rows[0];
}

export async function findCustomerByName(name: string): Promise<CustomerRow | undefined> {
  const trimmed = name.trim();
  if (!trimmed) return undefined;
  const rows = await db
    .select()
    .from(customers)
    .where(sql`lower(${customers.name}) = lower(${trimmed})`)
    .limit(1);
  return rows[0];
}

export async function createCustomer(data: NewCustomer): Promise<CustomerRow> {
  const rows = await db.insert(customers).values(data).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create customer");
  return created;
}

export async function upsertCustomerByPorterId(
  porterClientId: string,
  data: { name: string; email?: string | null; phone?: string | null },
): Promise<CustomerRow> {
  const existing = await findCustomerByPorterId(porterClientId);
  if (existing) {
    const rows = await db
      .update(customers)
      .set({
        name: data.name,
        email: data.email ?? existing.email,
        phone: data.phone ?? existing.phone,
        updatedAt: new Date(),
      })
      .where(eq(customers.id, existing.id))
      .returning();
    const updated = rows[0];
    if (!updated) throw new Error("Failed to update customer");
    return updated;
  }
  return createCustomer({
    porterClientId,
    name: data.name,
    email: data.email ?? null,
    phone: data.phone ?? null,
  });
}

export async function updateCustomerCachedStats(
  customerId: string,
  stats: {
    totalSpent: string;
    appointmentCount: number;
    firstAppointmentDate: Date | null;
    lastAppointmentDate: Date | null;
    typicalGapDays: number | null;
  },
): Promise<void> {
  await db
    .update(customers)
    .set({
      totalSpent: stats.totalSpent,
      appointmentCount: stats.appointmentCount,
      firstAppointmentDate: stats.firstAppointmentDate,
      lastAppointmentDate: stats.lastAppointmentDate,
      typicalGapDays: stats.typicalGapDays,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
}

export async function findCustomerById(
  customerId: string,
): Promise<CustomerRow | undefined> {
  const rows = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);
  return rows[0];
}

export async function listCustomers(): Promise<CustomerRow[]> {
  return db.select().from(customers).orderBy(desc(customers.lastAppointmentDate));
}

export interface CustomerAppointmentHistoryRow {
  appointmentId: string;
  appointmentDate: Date;
  completedDate: Date | null;
  status: string;
  serviceType: string;
  artistId: string | null;
  artistName: string | null;
  notes: string | null;
  totalRevenue: string | null;
}

export async function getCustomerAppointmentHistory(
  customerId: string,
): Promise<CustomerAppointmentHistoryRow[]> {
  return db
    .select({
      appointmentId: appointments.id,
      appointmentDate: appointments.appointmentDate,
      completedDate: appointments.completedDate,
      status: appointments.status,
      serviceType: appointments.serviceType,
      artistId: appointments.artistId,
      artistName: artists.name,
      notes: appointments.notes,
      totalRevenue: appointmentPayments.totalRevenue,
    })
    .from(appointments)
    .leftJoin(artists, eq(artists.id, appointments.artistId))
    .leftJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .where(eq(appointments.customerId, customerId))
    .orderBy(asc(appointments.appointmentDate));
}

export interface ContinuityRawCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredArtistId: string | null;
  referredByCustomerId: string | null;
  totalSpent: string | null;
  appointmentCount: number | null;
  firstAppointmentDate: Date | null;
  lastAppointmentDate: Date | null;
  typicalGapDays: number | null;
}

export async function getCustomersForContinuityRaw(): Promise<ContinuityRawCustomer[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      email: customers.email,
      phone: customers.phone,
      preferredArtistId: customers.preferredArtistId,
      referredByCustomerId: customers.referredByCustomerId,
      totalSpent: customers.totalSpent,
      appointmentCount: customers.appointmentCount,
      firstAppointmentDate: customers.firstAppointmentDate,
      lastAppointmentDate: customers.lastAppointmentDate,
      typicalGapDays: customers.typicalGapDays,
    })
    .from(customers);
}

export interface CustomerSpendRow {
  customerId: string;
  customerName: string | null;
  totalSpend: number;
  appointmentCount: number;
  avgSpend: number;
}

export async function getCustomersByTotalSpend(
  limit: number,
): Promise<CustomerSpendRow[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const rows = await db
    .select({
      customerId: appointments.customerId,
      customerName: customers.name,
      totalSpend: sql<string>`COALESCE(SUM(${appointmentPayments.totalRevenue}::numeric), 0)::text`,
      appointmentCount: sql<number>`COUNT(${appointments.id})::int`,
    })
    .from(appointments)
    .innerJoin(
      appointmentPayments,
      eq(appointmentPayments.appointmentId, appointments.id),
    )
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(sql`${appointments.customerId} IS NOT NULL`)
    .groupBy(appointments.customerId, customers.name)
    .orderBy(desc(sql`SUM(${appointmentPayments.totalRevenue}::numeric)`))
    .limit(capped);

  return rows
    .filter((row): row is typeof row & { customerId: string } => row.customerId != null)
    .map((row) => {
      const totalSpend = Number(row.totalSpend ?? 0);
      const appointmentCount = row.appointmentCount;
      const avgSpend =
        appointmentCount > 0 ? Math.round((totalSpend / appointmentCount) * 100) / 100 : 0;
      return {
        customerId: row.customerId,
        customerName: row.customerName,
        totalSpend,
        appointmentCount,
        avgSpend,
      };
    });
}

export type { CustomerRow as Customer };
