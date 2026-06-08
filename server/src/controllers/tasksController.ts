import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as taskService from "../services/taskService.js";
import { AppError } from "../utils/errors.js";

const statusQuerySchema = z.enum(["open", "in_progress", "completed", "all"]).optional();

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = statusQuerySchema.safeParse(req.query["status"]);
    const status = parsed.success ? parsed.data : undefined;
    const tasks = await taskService.listTasks(status ?? "all");
    res.json({ tasks });
  } catch (err) {
    next(err);
  }
}

export async function complete(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Task id required", 400);
    }
    const task = await taskService.completeTask(id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function reopen(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Task id required", 400);
    }
    const task = await taskService.reopenTask(id);
    res.json({ task });
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Task id required", 400);
    }
    await taskService.deleteTask(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
