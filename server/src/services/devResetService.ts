import { env } from "../config/env.js";
import { dedupeTaskDescriptions } from "../lib/jarvisDedup.js";
import * as devResetRepo from "../repos/devResetRepo.js";
import * as incidentRepo from "../repos/incidentRepo.js";
import * as taskRepo from "../repos/taskRepo.js";
import { AppError } from "../utils/errors.js";

export async function resetDashboardMetrics(): Promise<{ cleared: true }> {
  if (env.NODE_ENV === "production") {
    throw new AppError("Dashboard reset is not available in production", 403);
  }
  await devResetRepo.truncateDashboardData();
  return { cleared: true };
}

export async function cleanupDuplicateFacilityTasks(): Promise<{
  removed: number;
  removedTaskIds: string[];
}> {
  if (env.NODE_ENV === "production") {
    throw new AppError("Duplicate cleanup is not available in production", 403);
  }

  const [openTasks, openIncidents] = await Promise.all([
    taskRepo.listTasks({ status: "open", limit: 500 }),
    incidentRepo.listIncidents({ status: "open", limit: 500 }),
  ]);

  const idsToRemove = dedupeTaskDescriptions(
    openTasks.map((t) => ({
      id: t.id,
      description: t.description,
      title: t.title,
    })),
    openIncidents.map((i) => ({ description: i.description })),
  );

  for (const id of idsToRemove) {
    await taskRepo.deleteTask(id);
  }

  return { removed: idsToRemove.length, removedTaskIds: idsToRemove };
}
