import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import * as briefingService from "../services/briefingService.js";
import { AppError } from "../utils/errors.js";

const generateBodySchema = z.object({
  type: z.enum(["daily", "weekly", "monthly"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  type: z.enum(["daily", "weekly", "monthly"]).optional(),
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function generate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = generateBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError("Invalid body: type daily|weekly|monthly required", 400);
    }

    const result = await briefingService.generateBriefing(
      studioId(req),
      parsed.data.type,
      env.DEFAULT_TIMEZONE,
      {
        dateISO: parsed.data.date,
        startISO: parsed.data.start,
        endISO: parsed.data.end,
        year: parsed.data.year,
        month: parsed.data.month,
      },
    );

    res.status(201).json({
      briefingId: result.briefingId,
      narrative: result.narrative,
      delivered: result.delivered,
      period: result.snapshot.period,
      dateLabel: result.snapshot.dateLabel,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLatest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const type = z.enum(["daily", "weekly", "monthly"]).optional().safeParse(
      req.query["type"],
    );
    if (!type.success && req.query["type"] !== undefined) {
      throw new AppError("Invalid query: type must be daily, weekly, or monthly", 400);
    }
    const briefing = await briefingService.getLatestBriefing(type.data);
    res.json(briefing);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid history query parameters", 400);
    }
    const rows = await briefingService.getBriefingHistory(
      parsed.data.limit,
      parsed.data.type,
    );
    res.json({ briefings: rows });
  } catch (err) {
    next(err);
  }
}
