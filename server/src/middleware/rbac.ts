import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@fallen-sparrow/shared/constants";
import { AppError } from "../utils/errors.js";

export function requireRoles(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Unauthorized", 401));
      return;
    }
    const role = req.user.role as UserRole;
    if (!allowed.includes(role)) {
      next(new AppError("Forbidden", 403));
      return;
    }
    next();
  };
}

export const requireManager = requireRoles("OWNER", "MANAGER");

export const requireOwner = requireRoles("OWNER");
