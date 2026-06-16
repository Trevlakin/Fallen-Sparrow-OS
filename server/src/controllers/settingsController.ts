import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as settingsService from "../services/settingsService.js";
import { AppError } from "../utils/errors.js";

const patchBodySchema = z
  .object({
    walkInBonus: z.number().min(0).optional(),
    referralBonus: z.number().min(0).optional(),
    timezone: z.string().min(1).optional(),
    briefingHour: z.number().int().min(0).max(23).optional(),
    nudgeGapDays: z.number().int().min(1).optional(),
  })
  .strict();

const commissionTiersBodySchema = z.object({
  tiers: z
    .array(
      z.object({
        thresholdAmount: z.number().min(0),
        artistPct: z.number().min(0).max(100),
      }),
    )
    .min(1),
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function getSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const settings = await settingsService.getShopSettings(studioId(req));
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export async function patchSettings(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = patchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid settings payload", 400);
    }
    const merged = await settingsService.upsertShopSettings(
      studioId(req),
      parsed.data,
    );
    res.json(merged);
  } catch (err) {
    next(err);
  }
}

export async function getCommissionTiers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tiers = await settingsService.getCommissionTiers();
    res.json(tiers);
  } catch (err) {
    next(err);
  }
}

export async function putCommissionTiers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = commissionTiersBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid commission tiers payload", 400);
    }
    const saved = await settingsService.upsertCommissionTiers(parsed.data.tiers);
    res.json(saved);
  } catch (err) {
    next(err);
  }
}
