import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as settingsService from "../services/settingsService.js";
import { AppError } from "../utils/errors.js";

const patchBodySchema = z
  .object({
    commissionRates: z
      .object({
        tattoo: z.number().min(0).max(1).optional(),
        piercing: z.number().min(0).max(1).optional(),
        laser: z.number().min(0).max(1).optional(),
        other: z.number().min(0).max(1).optional(),
      })
      .optional(),
    walkInBonus: z.number().min(0).optional(),
    referralBonus: z.number().min(0).optional(),
    timezone: z.string().min(1).optional(),
    briefingHour: z.number().int().min(0).max(23).optional(),
    nudgeGapDays: z.number().int().min(1).optional(),
    confirmRates: z.boolean().optional(),
  })
  .strict();

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
    const updates: Partial<settingsService.FallenSparrowSettings> = {
      ...parsed.data,
      commissionRates: parsed.data.commissionRates
        ? {
            ...(await settingsService.getShopSettings(studioId(req))).commissionRates,
            ...parsed.data.commissionRates,
          }
        : undefined,
    };
    const merged = await settingsService.upsertShopSettings(studioId(req), updates);
    res.json(merged);
  } catch (err) {
    next(err);
  }
}
