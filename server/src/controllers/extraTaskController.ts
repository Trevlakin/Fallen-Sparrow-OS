import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getStudioDay } from "@fallen-sparrow/shared";
import { env } from "../config/env.js";
import * as extraTaskService from "../services/extraTaskService.js";
import { AppError } from "../utils/errors.js";

const sessionDateQuerySchema = z.object({
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const createExtraTaskSchema = z.object({
  description: z.string().min(1),
  loggedByLabel: z.string().min(1).optional(),
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "done"]),
});

function todayISO(): string {
  return getStudioDay(new Date(), env.DEFAULT_TIMEZONE);
}

export async function listTodayExtraTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = sessionDateQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid session date", 400);
    }
    const sessionDate = parsed.data.sessionDate ?? todayISO();
    const tasks = await extraTaskService.listTodayExtraTasks(sessionDate);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function listOpenExtraTasks(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tasks = await extraTaskService.listOpenExtraTasks(10);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function createExtraTask(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistAuth) {
      throw new AppError("Checklist session required", 401);
    }

    const parsed = createExtraTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid extra task payload", 400);
    }

    const task = await extraTaskService.createExtraTask({
      description: parsed.data.description,
      teamMemberId: req.checklistAuth.teamMemberId,
      loggedByLabel: parsed.data.loggedByLabel ?? "Team member",
      sessionDate: parsed.data.sessionDate,
    });

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function updateExtraTaskStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawTaskId = req.params["taskId"];
    const taskId = typeof rawTaskId === "string" ? rawTaskId : rawTaskId?.[0];
    if (!taskId) {
      throw new AppError("Task id required", 400);
    }

    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid status", 400);
    }

    const task = await extraTaskService.updateExtraTaskStatus(
      taskId,
      parsed.data.status,
    );
    res.json(task);
  } catch (err) {
    next(err);
  }
}
