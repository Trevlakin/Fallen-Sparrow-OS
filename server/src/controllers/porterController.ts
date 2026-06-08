import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as porterService from "../services/porterIngestionService.js";
import { AppError } from "../utils/errors.js";
import {
  hasWebhookSecret,
  verifyWebhookSignature,
} from "../integrations/resend.js";
import {
  extractCsvFromJsonBody,
  extractCsvFromMultipart,
} from "../utils/webhookCsv.js";

const csvBodySchema = z.object({
  csv: z.string().min(1),
});

export async function ingestCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = csvBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("Invalid CSV payload: csv string required", 400);
    }
    const result = await porterService.ingestCsv(parsed.data.csv);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function ingestWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!hasWebhookSecret()) {
      res.status(503).json({ error: "webhook_not_configured" });
      return;
    }

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      throw new AppError("Empty webhook body", 400);
    }

    const signatureHeader =
      req.headers["resend-signature"] ??
      req.headers["x-resend-signature"] ??
      req.headers["svix-signature"];

    const signature = Array.isArray(signatureHeader)
      ? signatureHeader[0]
      : signatureHeader;

    if (!signature || !verifyWebhookSignature(rawBody, signature)) {
      res.status(401).json({ error: "invalid_signature" });
      return;
    }

    const contentType = String(req.headers["content-type"] ?? "");
    let csvText: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      csvText = await extractCsvFromMultipart(rawBody, contentType);
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody.toString("utf8"));
      } catch {
        throw new AppError("Webhook body must be multipart or JSON", 400);
      }
      csvText = extractCsvFromJsonBody(parsed);
    }

    if (!csvText || csvText.trim().length === 0) {
      throw new AppError("No CSV attachment found in webhook payload", 400);
    }

    const result = await porterService.ingestCsv(csvText);
    res.json({ ok: true, recordsIngested: result.upserted });
  } catch (err) {
    next(err);
  }
}
