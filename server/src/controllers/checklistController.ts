import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getTodayInTimezone } from "@fallen-sparrow/shared";
import { env } from "../config/env.js";
import { PinLoginSchema } from "../validators/sopValidators.js";
import * as checklistService from "../services/checklistService.js";
import * as sopService from "../services/sopService.js";
import * as teamMemberService from "../services/teamMemberService.js";
import { AppError } from "../utils/errors.js";

const verifySchema = z
  .object({
    token: z.string().min(1).optional(),
    pin: z.string().length(4).optional(),
  })
  .refine((v) => Boolean(v.token || v.pin), {
    message: "Token or PIN required",
  });

const sessionDateSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function todayISO(): string {
  return getTodayInTimezone(env.DEFAULT_TIMEZONE);
}

export async function listEmployees(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const employees = await teamMemberService.listTeamMembersForChecklist();
    res.json({ employees });
  } catch (err) {
    next(err);
  }
}

export async function pinLogin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = PinLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid login payload", 400);
    }
    const result = await checklistService.pinLogin(
      parsed.data.teamMemberId,
      parsed.data.pin,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTodayChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistAuth) {
      throw new AppError("Checklist session required", 401);
    }
    const sessionDate =
      typeof req.query["sessionDate"] === "string"
        ? req.query["sessionDate"]
        : todayISO();
    const data = await checklistService.getTodayChecklist(
      req.checklistAuth.teamMemberId,
      req.checklistAuth.role,
      sessionDate,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function completeChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistAuth) {
      throw new AppError("Checklist session required", 401);
    }
    const itemId = String(req.params["itemId"] ?? "");
    const sessionDate =
      typeof req.body?.sessionDate === "string"
        ? req.body.sessionDate
        : todayISO();
    await checklistService.completeChecklistItem(
      req.checklistAuth.teamMemberId,
      itemId,
      sessionDate,
      req.checklistAuth.role,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function uncompleteChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistAuth) {
      throw new AppError("Checklist session required", 401);
    }
    const itemId = String(req.params["itemId"] ?? "");
    const sessionDate =
      typeof req.body?.sessionDate === "string"
        ? req.body.sessionDate
        : todayISO();
    await checklistService.uncompleteChecklistItem(
      req.checklistAuth.teamMemberId,
      itemId,
      sessionDate,
      req.checklistAuth.role,
    );
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

/** Sprint 9A: start today's checklist session (idempotent). */
export async function startSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistAuth) {
      throw new AppError("Checklist session required", 401);
    }
    const sessionDate = todayISO();
    res.json({ sessionDate, teamMemberId: req.checklistAuth.teamMemberId, role: req.checklistAuth.role });
  } catch (err) {
    next(err);
  }
}

/** Sprint 9A: admin summary of today's completion per employee. */
export async function adminSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Auth required", 401);
    }
    const sessionDate = todayISO();
    const statuses = await sopService.getTodayStatusAllRoles(undefined, env.DEFAULT_TIMEZONE);
    res.json({ statuses, sessionDate });
  } catch (err) {
    next(err);
  }
}

/** Legacy token/PIN access flow (checklist_access table). */
export async function verifyAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Token or PIN required", 400);
    }
    const result = await sopService.verifyChecklistAccess(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getItems(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistSession) {
      throw new AppError("Checklist session required", 401);
    }
    const parsed = sessionDateSchema.safeParse({
      sessionDate:
        typeof req.query["sessionDate"] === "string"
          ? req.query["sessionDate"]
          : todayISO(),
    });
    const data = await sopService.getChecklistForSession(
      req.checklistSession,
      parsed.success ? parsed.data.sessionDate : todayISO(),
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function completeItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistSession) {
      throw new AppError("Checklist session required", 401);
    }
    const itemId = String(req.params["itemId"] ?? "");
    const parsed = sessionDateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("sessionDate required (YYYY-MM-DD)", 400);
    }
    await sopService.assertItemBelongsToSop(
      itemId,
      req.checklistSession.sopId,
    );
    await sopService.completeItem(itemId, parsed.data.sessionDate, {
      accessLabel: req.checklistSession.label,
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function uncompleteItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.checklistSession) {
      throw new AppError("Checklist session required", 401);
    }
    const itemId = String(req.params["itemId"] ?? "");
    const parsed = sessionDateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("sessionDate required (YYYY-MM-DD)", 400);
    }
    await sopService.assertItemBelongsToSop(
      itemId,
      req.checklistSession.sopId,
    );
    await sopService.uncompleteItem(itemId, parsed.data.sessionDate);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
