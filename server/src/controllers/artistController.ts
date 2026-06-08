import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as artistAnalyticsService from "../services/artistAnalyticsService.js";
import { AppError } from "../utils/errors.js";

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const periodQuerySchema = z.object({
  from: dateParamSchema,
  to: dateParamSchema,
});

const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

function parsePeriod(from: string, to: string): { fromDate: Date; toDate: Date } {
  return {
    fromDate: new Date(`${from}T00:00:00.000Z`),
    toDate: new Date(`${to}T23:59:59.999Z`),
  };
}

export async function getAllPerformance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = periodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: from=YYYY-MM-DD and to=YYYY-MM-DD required", 400);
    }
    const { fromDate, toDate } = parsePeriod(parsed.data.from, parsed.data.to);
    const summary = await artistAnalyticsService.getAllArtistsPerformanceSummary(
      fromDate,
      toDate,
    );
    res.json({ artists: summary });
  } catch (err) {
    next(err);
  }
}

export async function getArtistPerformance(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = periodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: from=YYYY-MM-DD and to=YYYY-MM-DD required", 400);
    }
    const artistId = z.string().uuid().safeParse(req.params["id"]);
    if (!artistId.success) {
      throw new AppError("Invalid artist id", 400);
    }
    const { fromDate, toDate } = parsePeriod(parsed.data.from, parsed.data.to);
    const summary = await artistAnalyticsService.getArtistPerformanceSummary(
      artistId.data,
      fromDate,
      toDate,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getArtistRecent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const artistId = z.string().uuid().safeParse(req.params["id"]);
    if (!artistId.success) {
      throw new AppError("Invalid artist id", 400);
    }
    const parsed = recentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: limit must be 1-50", 400);
    }
    const from = new Date(0);
    const to = new Date();
    const summary = await artistAnalyticsService.getArtistPerformanceSummary(
      artistId.data,
      from,
      to,
      parsed.data.limit,
    );
    res.json({ recentAppointments: summary.recentAppointments });
  } catch (err) {
    next(err);
  }
}
