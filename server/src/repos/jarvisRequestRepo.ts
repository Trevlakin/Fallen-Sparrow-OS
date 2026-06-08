import { desc, eq, and } from "drizzle-orm";
import { jarvisRequests } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export type JarvisRequestRow = typeof jarvisRequests.$inferSelect;

const HISTORY_LIMIT = 50;

export async function insertJarvisRequest(values: {
  authorUserId: string;
  rawInput: string;
  intent: string;
  inputType: string;
  responsePreview: string | null;
}): Promise<JarvisRequestRow> {
  const [row] = await db
    .insert(jarvisRequests)
    .values({
      authorUserId: values.authorUserId,
      rawInput: values.rawInput,
      intent: values.intent,
      inputType: values.inputType,
      responsePreview: values.responsePreview,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to insert jarvis request");
  }
  return row;
}

export async function listByAuthor(
  authorUserId: string,
  limit = HISTORY_LIMIT,
): Promise<JarvisRequestRow[]> {
  return db
    .select()
    .from(jarvisRequests)
    .where(eq(jarvisRequests.authorUserId, authorUserId))
    .orderBy(desc(jarvisRequests.createdAt))
    .limit(limit);
}

export async function deleteByIdForAuthor(
  id: string,
  authorUserId: string,
): Promise<boolean> {
  const deleted = await db
    .delete(jarvisRequests)
    .where(
      and(
        eq(jarvisRequests.id, id),
        eq(jarvisRequests.authorUserId, authorUserId),
      ),
    )
    .returning({ id: jarvisRequests.id });
  return deleted.length > 0;
}

export async function deleteAllForAuthor(authorUserId: string): Promise<number> {
  const deleted = await db
    .delete(jarvisRequests)
    .where(eq(jarvisRequests.authorUserId, authorUserId))
    .returning({ id: jarvisRequests.id });
  return deleted.length;
}
