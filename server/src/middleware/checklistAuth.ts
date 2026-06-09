import type { Request, Response, NextFunction } from "express";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import * as authService from "../services/authService.js";
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

    try {
      req.checklistAuth = verifyChecklistToken(token);
      next();
      return;
    } catch (checklistErr) {
      if (checklistErr instanceof AppError && checklistErr.statusCode !== 401) {
        throw checklistErr;
      }
    }

    const payload = authService.verifyToken(token);
    if (authService.isPinAuthPayload(payload)) {
      req.checklistAuth = {
        type: "checklist",
        teamMemberId: payload.sub,
        role: payload.role as TeamMemberRole,
      };
      next();
      return;
    }

    throw new AppError("Checklist session required", 401);
  } catch (err) {
    next(err);
  }
}
