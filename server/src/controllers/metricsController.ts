import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as metricsService from "../services/metricsService.js";
import { AppError } from "../utils/errors.js";

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const dailyQuerySchema = z.object({
  date: dateParamSchema,
});

const weeklyQuerySchema = z.object({
  start: dateParamSchema,
  end: dateParamSchema,
});

const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const ytdQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function getDaily(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = dailyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: date=YYYY-MM-DD required", 400);
    }
    const summary = await metricsService.getDailySummary(parsed.data.date);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getWeekly(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = weeklyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        "Invalid query: start=YYYY-MM-DD and end=YYYY-MM-DD required",
        400,
      );
    }
    const summary = await metricsService.getWeeklySummary(
      parsed.data.start,
      parsed.data.end,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getMonthly(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = monthlyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: year=YYYY and month=M required", 400);
    }
    const summary = await metricsService.getMonthlySummary(
      parsed.data.year,
      parsed.data.month,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getYtd(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = ytdQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: year=YYYY required", 400);
    }
    const summary = await metricsService.getYtdSummary(studioId(req), parsed.data.year);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}
