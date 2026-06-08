import { desc, eq } from "drizzle-orm";
import { briefings } from "@fallen-sparrow/shared/schema";

export type BriefingRow = typeof briefings.$inferSelect;
import { db } from "../config/database.js";

export type BriefingInsert = {
  briefingType: string;
  periodStart: Date;
  periodEnd: Date;
  dataSnapshot: unknown;
  narrative: string;
};

export async function insertBriefing(data: BriefingInsert): Promise<BriefingRow> {
  const rows = await db
    .insert(briefings)
    .values({
      briefingType: data.briefingType,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dataSnapshot: data.dataSnapshot,
      narrative: data.narrative,
      deliveredVia: null,
      deliveredAt: null,
    })
    .returning();
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to insert briefing");
  }
  return created;
}

export async function markBriefingDelivered(
  briefingId: string,
  deliveredVia: string,
): Promise<BriefingRow> {
  const rows = await db
    .update(briefings)
    .set({
      deliveredVia,
      deliveredAt: new Date(),
    })
    .where(eq(briefings.id, briefingId))
    .returning();
  const updated = rows[0];
  if (!updated) {
    throw new Error("Briefing not found");
  }
  return updated;
}

export async function findLatestBriefing(
  briefingType?: string,
): Promise<BriefingRow | undefined> {
  const query = db
    .select()
    .from(briefings)
    .orderBy(desc(briefings.generatedAt))
    .limit(1);

  if (briefingType) {
    const rows = await db
      .select()
      .from(briefings)
      .where(eq(briefings.briefingType, briefingType))
      .orderBy(desc(briefings.generatedAt))
      .limit(1);
    return rows[0];
  }

  const rows = await query;
  return rows[0];
}

export async function listBriefingHistory(
  limit = 30,
  briefingType?: string,
): Promise<BriefingRow[]> {
  if (briefingType) {
    return db
      .select()
      .from(briefings)
      .where(eq(briefings.briefingType, briefingType))
      .orderBy(desc(briefings.generatedAt))
      .limit(limit);
  }
  return db
    .select()
    .from(briefings)
    .orderBy(desc(briefings.generatedAt))
    .limit(limit);
}

export async function findBriefingById(
  briefingId: string,
): Promise<BriefingRow | undefined> {
  const rows = await db
    .select()
    .from(briefings)
    .where(eq(briefings.id, briefingId))
    .limit(1);
  return rows[0];
}
