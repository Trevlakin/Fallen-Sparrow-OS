import type { Request, Response, NextFunction } from "express";
import { verifyChecklistToken } from "../services/checklistService.js";
import { AppError } from "../utils/errors.js";

export function checklistAuth(
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
    req.checklistAuth = verifyChecklistToken(token);
    next();
  } catch (err) {
    next(err);
  }
}
