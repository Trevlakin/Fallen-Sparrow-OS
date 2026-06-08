/**
 * Financial aggregates from appointmentPayments (MASTER_SPEC_v3 Sprint 3).
 * Grouped by artistId + serviceType, never productName.
 */
import { and, gte, lte, sql } from "drizzle-orm";
import { appointmentPayments, appointments } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal, type ServiceType } from "../lib/profit.js";

export interface PaymentAggregateRow {
  artistId: string;
  serviceType: ServiceType;
  revenue: number;
  tips: number;
  artistPayout: number;
  cost: number;
  count: number;
}

export interface AppointmentStatusCounts {
  noShow: number;
  cancelled: number;
}

function mapAggregateRow(row: {
  artistId: string;
  serviceType: ServiceType;
  revenue: string | null;
  tips: string | null;
  artistPayout: string | null;
  cost: string | null;
  count: number;
}): PaymentAggregateRow {
  return {
    artistId: row.artistId,
    serviceType: row.serviceType,
    revenue: parseDecimal(row.revenue),
    tips: parseDecimal(row.tips),
    artistPayout: parseDecimal(row.artistPayout),
    cost: parseDecimal(row.cost),
    count: row.count,
  };
}

export async function getPaymentAggregatesByArtistAndService(
  startDate: Date,
  endDate: Date,
): Promise<PaymentAggregateRow[]> {
  const rows = await db
    .select({
      artistId: appointmentPayments.artistId,
      serviceType: appointmentPayments.serviceType,
      revenue: sql<string>`COALESCE(SUM(${appointmentPayments.totalRevenue}::numeric), 0)::text`,
      tips: sql<string>`COALESCE(SUM(${appointmentPayments.tipAmount}::numeric), 0)::text`,
      artistPayout: sql<string>`COALESCE(SUM(${appointmentPayments.artistPayout}::numeric), 0)::text`,
      cost: sql<string>`COALESCE(SUM(COALESCE(${appointmentPayments.actualCost}, ${appointmentPayments.estimatedCost}, 0)::numeric), 0)::text`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointmentPayments)
    .where(
      and(
        gte(appointmentPayments.paymentDate, startDate),
        lte(appointmentPayments.paymentDate, endDate),
      ),
    )
    .groupBy(appointmentPayments.artistId, appointmentPayments.serviceType);

  return rows.map(mapAggregateRow);
}

export async function getAppointmentStatusCounts(
  startDate: Date,
  endDate: Date,
): Promise<AppointmentStatusCounts> {
  const rows = await db
    .select({
      status: appointments.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(appointments)
    .where(
      and(
        gte(appointments.appointmentDate, startDate),
        lte(appointments.appointmentDate, endDate),
      ),
    )
    .groupBy(appointments.status);

  let noShow = 0;
  let cancelled = 0;
  for (const row of rows) {
    if (row.status === "no_show") {
      noShow = row.count;
    } else if (row.status === "cancelled") {
      cancelled = row.count;
    }
  }

  return { noShow, cancelled };
}
