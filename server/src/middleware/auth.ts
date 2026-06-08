import type { Request, Response, NextFunction } from "express";
import * as authService from "../services/authService.js";
import { AppError } from "../utils/errors.js";

export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError("Authorization required", 401);
    }
    const token = header.slice(7);
    const payload = authService.verifyToken(token);
    req.user = await authService.getUserFromPayload(payload);
    next();
  } catch (err) {
    next(err);
  }
}
