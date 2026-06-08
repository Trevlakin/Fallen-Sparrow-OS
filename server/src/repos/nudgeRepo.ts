import { desc, eq } from "drizzle-orm";
import { nudges, type Nudge } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export async function getLatestNudgeForCustomer(
  customerId: string,
): Promise<Nudge | undefined> {
  const rows = await db
    .select()
    .from(nudges)
    .where(eq(nudges.customerId, customerId))
    .orderBy(desc(nudges.sentAt), desc(nudges.createdAt))
    .limit(1);
  return rows[0];
}

export async function insertNudge(data: {
  customerId: string;
  reason?: string;
  message?: string;
  channel?: string;
  sentAt?: Date | null;
}): Promise<Nudge> {
  const rows = await db
    .insert(nudges)
    .values({
      customerId: data.customerId,
      reason: data.reason ?? "friendly_reconnect",
      message: data.message ?? null,
      channel: data.channel ?? null,
      sentAt: data.sentAt ?? null,
    })
    .returning();
  const created = rows[0];
  if (!created) {
    throw new Error("Failed to insert nudge");
  }
  return created;
}

export async function markNudgeResonated(nudgeId: string): Promise<Nudge> {
  const rows = await db
    .update(nudges)
    .set({ resonated: true })
    .where(eq(nudges.id, nudgeId))
    .returning();
  const updated = rows[0];
  if (!updated) {
    throw new Error("Nudge not found");
  }
  return updated;
}

export async function updateNudgeSentAt(
  nudgeId: string,
  sentAt: Date,
): Promise<Nudge> {
  const rows = await db
    .update(nudges)
    .set({ sentAt })
    .where(eq(nudges.id, nudgeId))
    .returning();
  const updated = rows[0];
  if (!updated) {
    throw new Error("Nudge not found");
  }
  return updated;
}

export async function deleteNudge(nudgeId: string): Promise<void> {
  await db.delete(nudges).where(eq(nudges.id, nudgeId));
}

export async function findNudgeById(nudgeId: string): Promise<Nudge | undefined> {
  const rows = await db
    .select()
    .from(nudges)
    .where(eq(nudges.id, nudgeId))
    .limit(1);
  return rows[0];
}
