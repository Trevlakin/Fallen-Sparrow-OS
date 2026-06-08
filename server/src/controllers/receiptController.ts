import type { Request, Response, NextFunction } from "express";
import { createReadStream, existsSync } from "node:fs";
import * as receiptService from "../services/receiptService.js";
import { resolveLocalReceiptPath } from "../integrations/storage.js";
import { extractReceiptImageFromRequest } from "../utils/receiptUpload.js";
import { AppError } from "../utils/errors.js";

export async function uploadExpenseReceipt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.studioContext) {
      throw new AppError("Authentication required", 401);
    }

    const { buffer, contentType } = await extractReceiptImageFromRequest(req);
    const result = await receiptService.storeExpenseReceipt({
      studioId: req.studioContext.studioId,
      buffer,
      contentType,
    });

    res.json({
      receiptUrl: result.receiptUrl,
      storage: result.storage,
    });
  } catch (err) {
    next(err);
  }
}

export async function serveLocalReceipt(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.studioContext) {
      throw new AppError("Authentication required", 401);
    }

    const studioId = req.params["studioId"];
    const filename = req.params["filename"];
    if (!studioId || Array.isArray(studioId) || !filename || Array.isArray(filename)) {
      throw new AppError("Invalid receipt path", 400);
    }

    if (studioId !== req.studioContext.studioId) {
      throw new AppError("Receipt not found", 404);
    }

    const relativeKey = `${studioId}/${filename}`;
    const absolutePath = resolveLocalReceiptPath(relativeKey);
    if (!existsSync(absolutePath)) {
      throw new AppError("Receipt not found", 404);
    }

    const lower = filename.toLowerCase();
    const contentType = lower.endsWith(".png")
      ? "image/png"
      : lower.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    createReadStream(absolutePath).pipe(res);
  } catch (err) {
    next(err);
  }
}
