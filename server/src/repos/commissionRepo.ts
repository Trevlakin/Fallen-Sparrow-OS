/**
 * Commission aggregates from appointmentPayments + manual overrides in commissions table.
 * MASTER_SPEC_v3 §9, Sprint 5A.
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  appointmentPayments,
  commissions,
} from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

export interface ArtistPayoutPeriod {
  artistId: string;
  totalRevenue: number;
  totalArtistPayout: number;
  appointmentCount: number;
}

export interface ManualCommissionOverride {
  id: string;
  artistId: string;
  monthDate: Date;
  amount: number;
}

const MANUAL_OVERRIDE_STATUS = "manual_override";

function monthBoundsUtc(monthDate: Date): { periodStart: Date; periodEnd: Date } {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  return {
    periodStart: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    periodEnd: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}

// shopId accepted for future multi-location; single-tenant schema has no shopId column.
export async function getArtistPayoutsByPeriod(
  _shopId: string,
  artistId: string,
  from: Date,
  to: Date,
): Promise<ArtistPayoutPeriod> {
  const rows = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${appointmentPayments.totalRevenue}::numeric), 0)::text`,
      totalArtistPayout: sql<string>`COALESCE(SUM(${appointmentPayments.artistPayout}::numeric), 0)::text`,
      appointmentCount: sql<number>`COUNT(*)::int`,
    })
    .from(appointmentPayments)
    .where(
      and(
        eq(appointmentPayments.artistId, artistId),
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
      ),
    );

  const row = rows[0];
  return {
    artistId,
    totalRevenue: parseDecimal(row?.totalRevenue),
    totalArtistPayout: parseDecimal(row?.totalArtistPayout),
    appointmentCount: row?.appointmentCount ?? 0,
  };
}

export async function getAllArtistPayoutsByPeriod(
  _shopId: string,
  from: Date,
  to: Date,
): Promise<ArtistPayoutPeriod[]> {
  const rows = await db
    .select({
      artistId: appointmentPayments.artistId,
      totalRevenue: sql<string>`COALESCE(SUM(${appointmentPayments.totalRevenue}::numeric), 0)::text`,
      totalArtistPayout: sql<string>`COALESCE(SUM(${appointmentPayments.artistPayout}::numeric), 0)::text`,
      appointmentCount: sql<number>`COUNT(*)::int`,
    })
    .from(appointmentPayments)
    .where(
      and(
        gte(appointmentPayments.paymentDate, from),
        lte(appointmentPayments.paymentDate, to),
      ),
    )
    .groupBy(appointmentPayments.artistId);

  return rows.map((row) => ({
    artistId: row.artistId,
    totalRevenue: parseDecimal(row.totalRevenue),
    totalArtistPayout: parseDecimal(row.totalArtistPayout),
    appointmentCount: row.appointmentCount,
  }));
}

export async function upsertManualOverride(
  _shopId: string,
  artistId: string,
  monthDate: Date,
  amount: number,
): Promise<void> {
  const { periodStart, periodEnd } = monthBoundsUtc(monthDate);
  const amt = Math.max(0, amount);
  const amtStr = amt.toFixed(2);

  const existing = await db
    .select()
    .from(commissions)
    .where(
      and(
        eq(commissions.artistId, artistId),
        eq(commissions.periodStart, periodStart),
        eq(commissions.status, MANUAL_OVERRIDE_STATUS),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(commissions)
      .set({
        commissionEarned: amtStr,
        totalOwed: amtStr,
        serviceRevenue: "0",
        walkInBonus: "0",
        referralBonus: "0",
      })
      .where(eq(commissions.id, existing[0].id));
    return;
  }

  await db.insert(commissions).values({
    artistId,
    periodStart,
    periodEnd,
    serviceRevenue: "0",
    commissionEarned: amtStr,
    walkInBonus: "0",
    referralBonus: "0",
    totalOwed: amtStr,
    paidAmount: "0",
    status: MANUAL_OVERRIDE_STATUS,
  });
}

export async function listManualOverrides(
  _shopId: string,
  artistId: string,
): Promise<ManualCommissionOverride[]> {
  const rows = await db
    .select()
    .from(commissions)
    .where(
      and(
        eq(commissions.artistId, artistId),
        eq(commissions.status, MANUAL_OVERRIDE_STATUS),
      ),
    );

  return rows.map((row) => ({
    id: row.id,
    artistId: row.artistId,
    monthDate: row.periodStart,
    amount: parseDecimal(row.commissionEarned),
  }));
}
