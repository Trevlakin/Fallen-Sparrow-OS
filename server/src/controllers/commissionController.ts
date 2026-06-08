import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as commissionService from "../services/commissionService.js";
import { AppError } from "../utils/errors.js";

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const periodQuerySchema = z.object({
  start: dateParamSchema,
  end: dateParamSchema,
});

const overrideBodySchema = z.object({
  artistId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM"),
  amount: z.coerce.number().min(0),
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

function parsePeriod(start: string, end: string): { from: Date; to: Date } {
  return {
    from: new Date(`${start}T00:00:00.000Z`),
    to: new Date(`${end}T23:59:59.999Z`),
  };
}

export async function getSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = periodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        "Invalid query: start=YYYY-MM-DD and end=YYYY-MM-DD required",
        400,
      );
    }
    const { from, to } = parsePeriod(parsed.data.start, parsed.data.end);
    const summary = await commissionService.getAllArtistsCommissionSummary(
      studioId(req),
      from,
      to,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getArtist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = periodQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        "Invalid query: start=YYYY-MM-DD and end=YYYY-MM-DD required",
        400,
      );
    }
    const artistId = z.string().uuid().safeParse(req.params["id"]);
    if (!artistId.success) {
      throw new AppError("Invalid artist id", 400);
    }
    const { from, to } = parsePeriod(parsed.data.start, parsed.data.end);
    const summary = await commissionService.getArtistCommissionSummary(
      studioId(req),
      artistId.data,
      from,
      to,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function postOverride(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = overrideBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid body: artistId, month (YYYY-MM), amount required", 400);
    }
    await commissionService.upsertManualCommission(
      studioId(req),
      parsed.data.artistId,
      parsed.data.month,
      parsed.data.amount,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
