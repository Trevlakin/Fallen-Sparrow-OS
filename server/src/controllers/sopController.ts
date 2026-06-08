import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { USER_ROLES, type UserRole } from "@fallen-sparrow/shared/constants";
import { env } from "../config/env.js";
import {
  CreateChecklistItemSchema,
  CreateSopSchema,
  LegacySopEditorSchema,
  UpdateChecklistItemSchema,
  UpdateSopSchema,
} from "../validators/sopValidators.js";
import * as sopService from "../services/sopService.js";
import { AppError } from "../utils/errors.js";

const historyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

const accessCreateSchema = z.object({
  label: z.string().min(1),
  sopId: z.string().uuid(),
});

function parseRole(role: string | null | undefined): UserRole | null {
  if (!role) return null;
  const found = USER_ROLES.find((r) => r === role);
  return found ?? null;
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: env.DEFAULT_TIMEZONE,
  });
}

export async function listSops(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const grouped = await sopService.listSopsGroupedByRole();
    res.json({ grouped, sops: await sopService.listAllSops() });
  } catch (err) {
    next(err);
  }
}

export async function createSop(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const modern = CreateSopSchema.safeParse(req.body);
    if (modern.success) {
      const sop = await sopService.createSop(modern.data);
      res.status(201).json({ sop });
      return;
    }
    const legacy = LegacySopEditorSchema.safeParse(req.body);
    if (!legacy.success) {
      throw new AppError("Invalid SOP payload", 400);
    }
    const sop = await sopService.createSopLegacy({
      title: legacy.data.title,
      role: parseRole(legacy.data.role ?? null),
      frequency: legacy.data.frequency,
      items: legacy.data.items,
    });
    res.status(201).json({ sop });
  } catch (err) {
    next(err);
  }
}

export async function updateSop(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    const modern = UpdateSopSchema.safeParse(req.body);
    if (modern.success) {
      const sop = await sopService.updateSopAdmin(id, modern.data);
      res.json({ sop });
      return;
    }
    const legacy = LegacySopEditorSchema.safeParse(req.body);
    if (!legacy.success) {
      throw new AppError("Invalid SOP payload", 400);
    }
    const sop = await sopService.updateSop(id, {
      title: legacy.data.title,
      role: parseRole(legacy.data.role ?? null),
      frequency: legacy.data.frequency,
      items: legacy.data.items,
    });
    res.json({ sop });
  } catch (err) {
    next(err);
  }
}

export async function deleteSop(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    await sopService.deleteSop(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function addChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sopId = String(req.params["id"] ?? "");
    const parsed = CreateChecklistItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid checklist item payload", 400);
    }
    const item = await sopService.addSopChecklistItem(sopId, {
      text: parsed.data.text,
      sortOrder: parsed.data.sortOrder,
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
}

export async function updateChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sopId = String(req.params["id"] ?? "");
    const itemId = String(req.params["itemId"] ?? "");
    const parsed = UpdateChecklistItemSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid checklist item payload", 400);
    }
    const item = await sopService.updateSopChecklistItem(sopId, itemId, {
      text: parsed.data.text,
      sortOrder: parsed.data.sortOrder,
      isActive: parsed.data.isActive,
    });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function removeChecklistItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sopId = String(req.params["id"] ?? "");
    const itemId = String(req.params["itemId"] ?? "");
    await sopService.removeSopChecklistItem(sopId, itemId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getMyChecklist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    const sessionDate =
      typeof req.query["sessionDate"] === "string"
        ? req.query["sessionDate"]
        : todayISO();
    const result = await sopService.getMyChecklist(
      req.user.role as UserRole,
      sessionDate,
    );
    res.json(result ?? { sop: null, items: [] });
  } catch (err) {
    next(err);
  }
}

const sessionDateSchema = z.object({
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function completeItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    const itemId = String(req.params["itemId"] ?? "");
    const parsed = sessionDateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("sessionDate required (YYYY-MM-DD)", 400);
    }
    await sopService.completeItem(itemId, parsed.data.sessionDate, {
      userId: req.user.id,
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
    const itemId = String(req.params["itemId"] ?? "");
    const parsed = sessionDateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("sessionDate required (YYYY-MM-DD)", 400);
    }
    await sopService.uncompleteItem(itemId, parsed.data.sessionDate);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getTodayStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sessionDate =
      typeof req.query["sessionDate"] === "string"
        ? req.query["sessionDate"]
        : todayISO();
    const statuses = await sopService.getTodayStatusAllRoles(sessionDate);
    res.json({ statuses, sessionDate });
  } catch (err) {
    next(err);
  }
}

export async function getHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sopId = String(req.params["sopId"] ?? "");
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid days parameter", 400);
    }
    const history = await sopService.getCompletionHistory(
      sopId,
      parsed.data.days,
    );
    res.json({ history });
  } catch (err) {
    next(err);
  }
}

export async function listAccessCodes(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const accessCodes = await sopService.listAccessCodes();
    res.json({ accessCodes });
  } catch (err) {
    next(err);
  }
}

export async function createAccessCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = accessCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid access code payload", 400);
    }
    const result = await sopService.createAccessCode(parsed.data);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function revokeAccessCode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = String(req.params["id"] ?? "");
    await sopService.revokeAccessCode(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getSopDetailForDate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const sopId = String(req.params["sopId"] ?? "");
    const sessionDate =
      typeof req.query["sessionDate"] === "string"
        ? req.query["sessionDate"]
        : todayISO();
    const items = await sopService.getTodayCompletions(sopId, sessionDate);
    res.json({ sopId, sessionDate, items });
  } catch (err) {
    next(err);
  }
}
