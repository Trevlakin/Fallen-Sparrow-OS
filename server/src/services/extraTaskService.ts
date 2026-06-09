import { getStudioDay } from "@fallen-sparrow/shared";
import { env } from "../config/env.js";
import * as extraTaskRepo from "../repos/extraTaskRepo.js";
import { AppError } from "../utils/errors.js";

function todayISO(): string {
  return getStudioDay(new Date(), env.DEFAULT_TIMEZONE);
}

export async function listTodayExtraTasks(sessionDate?: string) {
  const date = sessionDate ?? todayISO();
  return extraTaskRepo.listExtraTasksForSession(date);
}

export async function listOpenExtraTasks(limit = 10) {
  return extraTaskRepo.listOpenExtraTasks(limit);
}

export async function createExtraTask(input: {
  description: string;
  teamMemberId: string;
  loggedByLabel: string;
  sessionDate?: string;
}) {
  const description = input.description.trim();
  if (!description) {
    throw new AppError("Description required", 400);
  }

  return extraTaskRepo.insertExtraTask({
    description,
    teamMemberId: input.teamMemberId,
    loggedByLabel: input.loggedByLabel,
    sessionDate: input.sessionDate ?? todayISO(),
  });
}

export async function updateExtraTaskStatus(
  taskId: string,
  status: extraTaskRepo.ExtraTaskStatus,
) {
  return extraTaskRepo.updateExtraTaskStatus(taskId, status);
}

export async function queryExtraTasksForJarvis(start: Date, end: Date) {
  const tasks = await extraTaskRepo.listExtraTasksInRange(start, end);

  return {
    total: tasks.length,
    open: tasks.filter((t) => t.status !== "done").length,
    done: tasks.filter((t) => t.status === "done").length,
    tasks: tasks.map((task) => ({
      description: task.description,
      status: task.status,
      loggedBy: task.loggedByLabel,
      loggedAt: task.loggedAt,
      completedAt: task.completedAt,
      duration:
        task.completedAt && task.loggedAt
          ? `${Math.round(
              (new Date(task.completedAt).getTime() -
                new Date(task.loggedAt).getTime()) /
                60_000,
            )} min`
          : "still open",
    })),
  };
}
