import type { Request, Response, NextFunction } from "express";
import * as devResetService from "../services/devResetService.js";

export async function resetDashboard(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await devResetService.resetDashboardMetrics();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cleanupDuplicateTasks(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await devResetService.cleanupDuplicateFacilityTasks();
    res.json(result);
  } catch (err) {
    next(err);
  }
}
