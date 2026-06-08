import { desc, eq } from "drizzle-orm";
import { taskQueue } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";
import { AppError } from "../utils/errors.js";

export type TaskStatus = "open" | "in_progress" | "completed";

export interface TaskRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string | null;
  dueDate: string | null;
  completedDate: string | null;
  createdAt: string;
}

function mapTaskRow(row: {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: TaskStatus | null;
  priority: string | null;
  dueDate: Date | null;
  completedDate: Date | null;
  createdAt: Date | null;
}): TaskRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status ?? "open",
    priority: row.priority,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedDate: row.completedDate?.toISOString() ?? null,
    createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

export async function listOpenTasks(limit = 20): Promise<
  { description: string; type: string }[]
> {
  const rows = await db
    .select({
      description: taskQueue.description,
      title: taskQueue.title,
      type: taskQueue.type,
    })
    .from(taskQueue)
    .where(eq(taskQueue.status, "open"))
    .orderBy(desc(taskQueue.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    description: row.description ?? row.title,
    type: row.type,
  }));
}

export async function listTasks(options?: {
  status?: TaskStatus | "all";
  limit?: number;
}): Promise<TaskRow[]> {
  const limit = options?.limit ?? 100;
  const status = options?.status ?? "all";

  const condition =
    status === "all"
      ? undefined
      : eq(taskQueue.status, status);

  const query = db
    .select({
      id: taskQueue.id,
      type: taskQueue.type,
      title: taskQueue.title,
      description: taskQueue.description,
      status: taskQueue.status,
      priority: taskQueue.priority,
      dueDate: taskQueue.dueDate,
      completedDate: taskQueue.completedDate,
      createdAt: taskQueue.createdAt,
    })
    .from(taskQueue)
    .orderBy(desc(taskQueue.createdAt))
    .limit(limit);

  const rows = condition ? await query.where(condition) : await query;
  return rows.map(mapTaskRow);
}

export async function completeTask(id: string): Promise<TaskRow> {
  const [row] = await db
    .update(taskQueue)
    .set({
      status: "completed",
      completedDate: new Date(),
    })
    .where(eq(taskQueue.id, id))
    .returning({
      id: taskQueue.id,
      type: taskQueue.type,
      title: taskQueue.title,
      description: taskQueue.description,
      status: taskQueue.status,
      priority: taskQueue.priority,
      dueDate: taskQueue.dueDate,
      completedDate: taskQueue.completedDate,
      createdAt: taskQueue.createdAt,
    });

  if (!row) {
    throw new AppError("Task not found", 404);
  }
  return mapTaskRow(row);
}

export async function reopenTask(id: string): Promise<TaskRow> {
  const [row] = await db
    .update(taskQueue)
    .set({
      status: "open",
      completedDate: null,
    })
    .where(eq(taskQueue.id, id))
    .returning({
      id: taskQueue.id,
      type: taskQueue.type,
      title: taskQueue.title,
      description: taskQueue.description,
      status: taskQueue.status,
      priority: taskQueue.priority,
      dueDate: taskQueue.dueDate,
      completedDate: taskQueue.completedDate,
      createdAt: taskQueue.createdAt,
    });

  if (!row) {
    throw new AppError("Task not found", 404);
  }
  return mapTaskRow(row);
}

export async function deleteTask(id: string): Promise<void> {
  const deleted = await db
    .delete(taskQueue)
    .where(eq(taskQueue.id, id))
    .returning({ id: taskQueue.id });
  if (deleted.length === 0) {
    throw new AppError("Task not found", 404);
  }
}
