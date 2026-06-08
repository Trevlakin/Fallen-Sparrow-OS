/**
 * P&L session-level payment queries (artist drill-down, paid tracking).
 */
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import {
  appointmentPayments,
  appointments,
  customers,
} from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

export interface ArtistPaymentSessionRow {
  paymentId: string;
  appointmentId: string;
  paymentDate: Date;
  clientName: string | null;
  serviceType: string;
  totalRevenue: number;
  artistPayout: number;
  artistPaidAt: Date | null;
  artistPayoutMethod: string | null;
}

export interface ArtistSessionRevenueRow {
  artistId: string;
  totalRevenue: number;
}

export async function listArtistSessionRevenues(
  from: Date,
  to: Date,
): Promise<ArtistSessionRevenueRow[]> {
  const rows = await db
    .select({
      artistId: appointmentPayments.artistId,
      totalRevenue: appointmentPayments.totalRevenue,
    })
    .from(appointmentPayments)
    .where(
      and(
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
      ),
    );

  return rows.map((row) => ({
    artistId: row.artistId,
    totalRevenue: parseDecimal(row.totalRevenue),
  }));
}

export async function listArtistPaymentSessions(
  artistId: string,
  from: Date,
  to: Date,
): Promise<ArtistPaymentSessionRow[]> {
  const rows = await db
    .select({
      paymentId: appointmentPayments.id,
      appointmentId: appointmentPayments.appointmentId,
      paymentDate: appointmentPayments.paymentDate,
      clientName: customers.name,
      serviceType: appointmentPayments.serviceType,
      totalRevenue: appointmentPayments.totalRevenue,
      artistPayout: appointmentPayments.artistPayout,
      artistPaidAt: appointmentPayments.artistPaidAt,
      artistPayoutMethod: appointmentPayments.artistPayoutMethod,
    })
    .from(appointmentPayments)
    .innerJoin(appointments, eq(appointments.id, appointmentPayments.appointmentId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(
      and(
        eq(appointmentPayments.artistId, artistId),
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
      ),
    )
    .orderBy(asc(appointmentPayments.paymentDate));

  return rows.map((row) => ({
    paymentId: row.paymentId,
    appointmentId: row.appointmentId,
    paymentDate: row.paymentDate,
    clientName: row.clientName,
    serviceType: row.serviceType,
    totalRevenue: parseDecimal(row.totalRevenue),
    artistPayout: parseDecimal(row.artistPayout),
    artistPaidAt: row.artistPaidAt,
    artistPayoutMethod: row.artistPayoutMethod,
  }));
}

export async function setPaymentArtistPayout(
  paymentId: string,
  paid: boolean,
  payoutMethod: string | null,
): Promise<boolean> {
  const rows = await db
    .update(appointmentPayments)
    .set({
      artistPaidAt: paid ? new Date() : null,
      artistPayoutMethod: paid ? payoutMethod : null,
    })
    .where(eq(appointmentPayments.id, paymentId))
    .returning({ id: appointmentPayments.id });

  return rows.length > 0;
}

export async function listUnpaidArtistPaymentSessions(
  artistId: string,
  from: Date,
  to: Date,
): Promise<ArtistPaymentSessionRow[]> {
  const rows = await db
    .select({
      paymentId: appointmentPayments.id,
      appointmentId: appointmentPayments.appointmentId,
      paymentDate: appointmentPayments.paymentDate,
      clientName: customers.name,
      serviceType: appointmentPayments.serviceType,
      totalRevenue: appointmentPayments.totalRevenue,
      artistPayout: appointmentPayments.artistPayout,
      artistPaidAt: appointmentPayments.artistPaidAt,
      artistPayoutMethod: appointmentPayments.artistPayoutMethod,
    })
    .from(appointmentPayments)
    .innerJoin(appointments, eq(appointments.id, appointmentPayments.appointmentId))
    .leftJoin(customers, eq(customers.id, appointments.customerId))
    .where(
      and(
        eq(appointmentPayments.artistId, artistId),
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
        isNull(appointmentPayments.artistPaidAt),
      ),
    )
    .orderBy(asc(appointmentPayments.paymentDate));

  return rows.map((row) => ({
    paymentId: row.paymentId,
    appointmentId: row.appointmentId,
    paymentDate: row.paymentDate,
    clientName: row.clientName,
    serviceType: row.serviceType,
    totalRevenue: parseDecimal(row.totalRevenue),
    artistPayout: parseDecimal(row.artistPayout),
    artistPaidAt: row.artistPaidAt,
    artistPayoutMethod: row.artistPayoutMethod,
  }));
}

export async function findPaymentArtistId(
  paymentId: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ artistId: appointmentPayments.artistId })
    .from(appointmentPayments)
    .where(eq(appointmentPayments.id, paymentId))
    .limit(1);

  return rows[0]?.artistId;
}
