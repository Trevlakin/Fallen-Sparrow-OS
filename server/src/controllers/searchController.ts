import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import type { UserRole } from "@fallen-sparrow/shared/constants";
import * as searchService from "../services/searchService.js";
import { AppError } from "../utils/errors.js";

const searchQuerySchema = z.object({
  q: z.string().max(searchService.MAX_SEARCH_QUERY_LENGTH).default(""),
});

const FINANCIAL_ROLES: UserRole[] = ["OWNER", "MANAGER"];

function canIncludeExpenses(role: UserRole): boolean {
  return FINANCIAL_ROLES.includes(role);
}

export async function search(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }

    const payload = await searchService.globalSearch(parsed.data.q, {
      includeExpenses: canIncludeExpenses(req.user.role as UserRole),
    });
    res.json(payload);
  } catch (err) {
    next(err);
  }
}
