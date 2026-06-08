import { and, desc, eq, gte, lte, ne } from "drizzle-orm";
import { extraTasks } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export type ExtraTaskStatus = "open" | "in_progress" | "done";

export interface ExtraTaskRow {
  id: string;
  description: string;
  teamMemberId: string | null;
  loggedByLabel: string | null;
  status: ExtraTaskStatus;
  loggedAt: string;
  completedAt: string | null;
  sessionDate: string;
  notes: string | null;
}

function mapRow(row: typeof extraTasks.$inferSelect): ExtraTaskRow {
  return {
    id: row.id,
    description: row.description,
    teamMemberId: row.teamMemberId,
    loggedByLabel: row.loggedByLabel,
    status: row.status as ExtraTaskStatus,
    loggedAt: row.loggedAt?.toISOString() ?? new Date().toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    sessionDate: row.sessionDate,
    notes: row.notes,
  };
}

export async function listExtraTasksForSession(
  sessionDate: string,
): Promise<ExtraTaskRow[]> {
  const rows = await db
    .select()
    .from(extraTasks)
    .where(eq(extraTasks.sessionDate, sessionDate))
    .orderBy(desc(extraTasks.loggedAt));

  return rows.map(mapRow);
}

export async function listOpenExtraTasks(limit = 10): Promise<ExtraTaskRow[]> {
  const rows = await db
    .select()
    .from(extraTasks)
    .where(ne(extraTasks.status, "done"))
    .orderBy(desc(extraTasks.loggedAt))
    .limit(limit);

  return rows.map(mapRow);
}

export async function listExtraTasksInRange(
  start: Date,
  end: Date,
): Promise<ExtraTaskRow[]> {
  const rows = await db
    .select()
    .from(extraTasks)
    .where(
      and(gte(extraTasks.loggedAt, start), lte(extraTasks.loggedAt, end)),
    )
    .orderBy(desc(extraTasks.loggedAt));

  return rows.map(mapRow);
}

export async function insertExtraTask(data: {
  description: string;
  teamMemberId: string;
  loggedByLabel: string;
  sessionDate: string;
}): Promise<ExtraTaskRow> {
  const [row] = await db
    .insert(extraTasks)
    .values({
      description: data.description,
      teamMemberId: data.teamMemberId,
      loggedByLabel: data.loggedByLabel,
      status: "open",
      sessionDate: data.sessionDate,
    })
    .returning();

  if (!row) {
    throw new AppError("Failed to create extra task", 500);
  }

  return mapRow(row);
}

export async function updateExtraTaskStatus(
  taskId: string,
  status: ExtraTaskStatus,
): Promise<ExtraTaskRow> {
  const update: {
    status: ExtraTaskStatus;
    completedAt?: Date | null;
  } = { status };

  if (status === "done") {
    update.completedAt = new Date();
  } else {
    update.completedAt = null;
  }

  const [row] = await db
    .update(extraTasks)
    .set(update)
    .where(eq(extraTasks.id, taskId))
    .returning();

  if (!row) {
    throw new AppError("Extra task not found", 404);
  }

  return mapRow(row);
}
