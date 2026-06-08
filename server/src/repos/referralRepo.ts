/**
 * Natural referral graph from customers.referredByCustomerId (MASTER_SPEC_v3 §6.4).
 */
import { desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { customers } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { parseDecimal } from "../lib/profit.js";

export interface TopReferrerRow {
  customerId: string;
  name: string;
  referralCount: number;
  totalReferredRevenue: number;
}

export async function getTopReferrers(limit: number): Promise<TopReferrerRow[]> {
  const rows = await db
    .select({
      customerId: customers.referredByCustomerId,
      referralCount: sql<number>`COUNT(*)::int`,
      totalReferredRevenue: sql<string>`COALESCE(SUM(${customers.totalSpent}::numeric), 0)::text`,
    })
    .from(customers)
    .where(isNotNull(customers.referredByCustomerId))
    .groupBy(customers.referredByCustomerId)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(limit);

  const referrerIds = rows
    .map((row) => row.customerId)
    .filter((id): id is string => id !== null);

  if (referrerIds.length === 0) {
    return [];
  }

  const referrers = await db
    .select({ id: customers.id, name: customers.name })
    .from(customers)
    .where(inArray(customers.id, referrerIds));

  const nameById = new Map(referrers.map((r) => [r.id, r.name]));

  return rows
    .filter((row): row is typeof row & { customerId: string } => row.customerId !== null)
    .map((row) => ({
      customerId: row.customerId,
      name: nameById.get(row.customerId) ?? "Unknown",
      referralCount: row.referralCount,
      totalReferredRevenue: parseDecimal(row.totalReferredRevenue),
    }));
}

export async function getReferralCountForCustomer(customerId: string): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(customers)
    .where(eq(customers.referredByCustomerId, customerId));
  return rows[0]?.count ?? 0;
}

export interface ReferredCustomerRow {
  id: string;
  name: string;
  totalSpent: string | null;
  lastAppointmentDate: Date | null;
}

export async function getReferredCustomers(
  referrerCustomerId: string,
): Promise<ReferredCustomerRow[]> {
  return db
    .select({
      id: customers.id,
      name: customers.name,
      totalSpent: customers.totalSpent,
      lastAppointmentDate: customers.lastAppointmentDate,
    })
    .from(customers)
    .where(eq(customers.referredByCustomerId, referrerCustomerId))
    .orderBy(desc(customers.createdAt));
}
