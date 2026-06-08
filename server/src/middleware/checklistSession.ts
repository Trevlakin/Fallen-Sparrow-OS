import type { Request, Response, NextFunction } from "express";
import { verifyChecklistSession } from "../services/sopService.js";
import { AppError } from "../utils/errors.js";

export function requireChecklistSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Checklist session required", 401);
    }
    const token = header.slice(7);
    req.checklistSession = verifyChecklistSession(token);
    next();
  } catch (err) {
    next(err);
  }
}
