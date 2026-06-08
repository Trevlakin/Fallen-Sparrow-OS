import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as followupService from "../services/followupService.js";
import { AppError } from "../utils/errors.js";

export async function getDueToday(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const followups = await followupService.getDueToday();
    res.json({ followups });
  } catch (err) {
    next(err);
  }
}

export async function getUpcoming(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const followups = await followupService.getUpcomingWeek();
    res.json({ followups });
  } catch (err) {
    next(err);
  }
}

const contactBodySchema = z.object({ notes: z.string().default("") });

export async function logContact(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    if (!id) throw new AppError("Follow-up id required", 400);
    const parsed = contactBodySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError("Invalid body", 400);
    await followupService.logContact(id, parsed.data.notes);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function closeFollowup(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    if (!id) throw new AppError("Follow-up id required", 400);
    await followupService.closeFollowup(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
