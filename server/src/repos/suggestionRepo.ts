import { suggestions } from "@fallen-sparrow/shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../config/database.js";

export type SuggestionRow = typeof suggestions.$inferSelect;

export async function listPending(): Promise<SuggestionRow[]> {
  return db
    .select()
    .from(suggestions)
    .where(eq(suggestions.status, "pending"));
}

export async function findById(id: string): Promise<SuggestionRow | undefined> {
  const rows = await db
    .select()
    .from(suggestions)
    .where(eq(suggestions.id, id))
    .limit(1);
  return rows[0];
}

export async function insertSuggestion(values: {
  brainDumpId: string | null;
  proposedType: "expense" | "incident" | "admin" | "follow_up" | "staff_note";
  rawText: string;
  parsedPayload: Record<string, unknown>;
  aiConfidence: string | null;
}): Promise<SuggestionRow> {
  const [row] = await db
    .insert(suggestions)
    .values({
      brainDumpId: values.brainDumpId,
      proposedType: values.proposedType,
      rawText: values.rawText,
      parsedPayload: values.parsedPayload,
      aiConfidence: values.aiConfidence,
      status: "pending",
    })
    .returning();
  if (!row) {
    throw new Error("Failed to insert suggestion");
  }
  return row;
}

export async function markPromoted(id: string): Promise<void> {
  await db
    .update(suggestions)
    .set({ status: "promoted" })
    .where(eq(suggestions.id, id));
}

export async function markDismissed(id: string): Promise<void> {
  await db
    .update(suggestions)
    .set({ status: "dismissed" })
    .where(eq(suggestions.id, id));
}
