import { desc, eq, gte } from "drizzle-orm";
import { strategicNotes } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export interface StrategicNoteRow {
  id: string;
  content: string;
  tags: string[];
  aiExpansion: string | null;
  createdAt: string;
}

export async function listRecentStrategicNotes(
  since: Date,
  limit = 10,
): Promise<{ content: string }[]> {
  const rows = await db
    .select({ content: strategicNotes.content })
    .from(strategicNotes)
    .where(gte(strategicNotes.createdAt, since))
    .orderBy(desc(strategicNotes.createdAt))
    .limit(limit);

  return rows.map((row) => ({ content: row.content }));
}

export async function listStrategicNotes(limit = 100): Promise<StrategicNoteRow[]> {
  const rows = await db
    .select({
      id: strategicNotes.id,
      content: strategicNotes.content,
      tags: strategicNotes.tags,
      aiExpansion: strategicNotes.aiExpansion,
      createdAt: strategicNotes.createdAt,
    })
    .from(strategicNotes)
    .orderBy(desc(strategicNotes.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    tags: row.tags ?? [],
    aiExpansion: row.aiExpansion ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  }));
}

export async function deleteStrategicNote(id: string): Promise<void> {
  const deleted = await db
    .delete(strategicNotes)
    .where(eq(strategicNotes.id, id))
    .returning({ id: strategicNotes.id });
  if (deleted.length === 0) {
    throw new AppError("Strategic note not found", 404);
  }
}
