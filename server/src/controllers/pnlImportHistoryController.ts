import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as pnlImportHistoryService from "../services/pnlImportHistoryService.js";
import { AppError } from "../utils/errors.js";

const listQuerySchema = z.object({
  type: z.enum(["expenses", "sales"]).optional(),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export async function listImports(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }
    const imports = await pnlImportHistoryService.listImports({
      importType: parsed.data.type,
    });
    res.json({ imports });
  } catch (err) {
    next(err);
  }
}

export async function deleteImport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = idParamSchema.safeParse(req.params);
    if (!parsed.success) {
      throw new AppError("Invalid import id", 400);
    }
    const deleted = await pnlImportHistoryService.deleteImport(parsed.data.id);
    if (!deleted) {
      throw new AppError("Import history entry not found", 404);
    }
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
