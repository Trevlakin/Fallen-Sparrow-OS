import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { TEAM_MEMBER_ROLES } from "@fallen-sparrow/shared/constants";
import * as sopHistoryService from "../services/sopHistoryService.js";
import { AppError } from "../utils/errors.js";

const historyParamsSchema = z.object({
  role: z.enum(TEAM_MEMBER_ROLES),
});

const historyQuerySchema = z.object({
  daysBack: z.coerce.number().int().min(1).max(365).default(7),
});

export async function getHistoryByRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const params = historyParamsSchema.safeParse(req.params);
    if (!params.success) {
      throw new AppError("Invalid role", 400);
    }
    const query = historyQuerySchema.safeParse(req.query);
    if (!query.success) {
      throw new AppError("Invalid daysBack", 400);
    }
    const history = await sopHistoryService.getHistoryByRole(
      params.data.role,
      query.data.daysBack,
    );
    res.json({ history });
  } catch (err) {
    next(err);
  }
}
