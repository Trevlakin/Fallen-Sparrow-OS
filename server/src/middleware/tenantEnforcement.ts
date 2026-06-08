/**
 * Single-studio tenant context (MASTER_SPEC_v3 §3, Sprint 1).
 * v3 schema has no studioId column yet; this attaches studio context for future multi-location.
 * All business tables are studio-scoped implicitly in single-tenant deployment.
 */
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

export const DEFAULT_STUDIO_ID = "fallen-sparrow-kissimmee";

export function enforceTenant(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError("Tenant context requires authentication", 401));
    return;
  }
  req.studioContext = { studioId: DEFAULT_STUDIO_ID };
  next();
}
