import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ARTIST_PAYOUT_METHODS } from "@fallen-sparrow/shared/constants";
import * as pnlService from "../services/pnlService.js";
import { AppError } from "../utils/errors.js";

const dateParamSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

const artistIdParamSchema = z.object({
  artistId: z.string().uuid(),
});

const paymentIdParamSchema = z.object({
  artistId: z.string().uuid(),
  paymentId: z.string().uuid(),
});

const setPaidBodySchema = z
  .object({
    paid: z.boolean(),
    payoutMethod: z.enum(ARTIST_PAYOUT_METHODS).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.paid && !data.payoutMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "payoutMethod required when marking paid",
        path: ["payoutMethod"],
      });
    }
  });

const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const rangeQuerySchema = z.object({
  start: dateParamSchema,
  end: dateParamSchema,
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function getMonthly(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = monthlyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: year and month required", 400);
    }
    const summary = await pnlService.getPnlMonthly(
      studioId(req),
      parsed.data.year,
      parsed.data.month,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getRange(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = rangeQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(
        "Invalid query: start=YYYY-MM-DD and end=YYYY-MM-DD required",
        400,
      );
    }
    const summary = await pnlService.getPnlRange(
      studioId(req),
      parsed.data.start,
      parsed.data.end,
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

export async function getArtistSessions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = artistIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new AppError("Invalid artist id", 400);
    }
    const query = rangeQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError(
        "Invalid query: start=YYYY-MM-DD and end=YYYY-MM-DD required",
        400,
      );
    }
    const result = await pnlService.getArtistPnlSessions(
      studioId(req),
      params.data.artistId,
      query.data.start,
      query.data.end,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function patchArtistSessionPaid(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = paymentIdParamSchema.safeParse(req.params);
    if (!params.success) {
      throw new AppError("Invalid artist or payment id", 400);
    }
    const body = setPaidBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError(
        body.error.issues[0]?.message ?? "Invalid body: paid (boolean) and payoutMethod when paid",
        400,
      );
    }
    const result = await pnlService.setArtistSessionPaid(
      studioId(req),
      params.data.artistId,
      params.data.paymentId,
      body.data.paid,
      body.data.paid ? (body.data.payoutMethod ?? null) : null,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}
