import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as nudgeService from "../services/nudgeService.js";
import { AppError } from "../utils/errors.js";

const sendBodySchema = z.object({
  channel: z.enum(["sms", "email"]).default("sms"),
});

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function getCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidates = await nudgeService.listNudgeCandidates(studioId(req));
    res.json({ candidates });
  } catch (err) {
    next(err);
  }
}

export async function sendNudge(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const customerId = z.string().uuid().safeParse(req.params["customerId"]);
    if (!customerId.success) {
      throw new AppError("Invalid customer id", 400);
    }
    const parsed = sendBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError("Invalid body: channel must be sms or email", 400);
    }
    const result = await nudgeService.sendNudge(
      studioId(req),
      customerId.data,
      parsed.data.channel,
    );
    const statusCode = result.status === "sent" ? 202 : 502;
    res.status(statusCode).json(result);
  } catch (err) {
    next(err);
  }
}

export async function markResonated(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const nudgeId = z.string().uuid().safeParse(req.params["nudgeId"]);
    if (!nudgeId.success) {
      throw new AppError("Invalid nudge id", 400);
    }
    const nudge = await nudgeService.markNudgeResonated(nudgeId.data);
    res.json(nudge);
  } catch (err) {
    next(err);
  }
}
