import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import * as quickbooksService from "../services/quickbooksService.js";
import { AppError } from "../utils/errors.js";

function studioId(req: Request): string {
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function getAuthUrl(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authUrl = quickbooksService.getAuthorizationUrl(studioId(req));
    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
}

export async function handleCallback(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const state =
      typeof req.query["state"] === "string" ? req.query["state"] : "";
    if (!state) {
      res.redirect(`${env.WEB_APP_URL}/settings?quickbooks=error`);
      return;
    }
    quickbooksService.verifyOAuthState(state);

    const redirectUri = env.QBO_REDIRECT_URI;
    if (!redirectUri) {
      res.redirect(`${env.WEB_APP_URL}/settings?quickbooks=error`);
      return;
    }

    const query = new URLSearchParams(
      Object.entries(req.query).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === "string") {
          acc[key] = value;
        }
        return acc;
      }, {}),
    );
    const callbackUrl = `${redirectUri}?${query.toString()}`;
    await quickbooksService.handleOAuthCallback(callbackUrl);

    res.redirect(`${env.WEB_APP_URL}/settings?quickbooks=connected`);
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect(`${env.WEB_APP_URL}/settings?quickbooks=error`);
      return;
    }
    next(err);
  }
}

export async function getStatus(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const status = await quickbooksService.getConnectionStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

const syncBodySchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function postSync(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = syncBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new AppError("Invalid sync payload", 400);
    }
    const result = await quickbooksService.syncExpenses(
      studioId(req),
      parsed.data.startDate,
      parsed.data.endDate,
    );
    res.json({
      success: true,
      message: `Synced ${result.synced} transactions from QuickBooks`,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (err) {
    next(err);
  }
}

const plQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function getPlReport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = plQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("startDate and endDate required (YYYY-MM-DD)", 400);
    }
    const report = await quickbooksService.getProfitAndLoss(
      studioId(req),
      parsed.data.startDate,
      parsed.data.endDate,
    );
    res.json(report);
  } catch (err) {
    next(err);
  }
}

export async function deleteConnection(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await quickbooksService.disconnectQuickBooks();
    res.json({ success: true, message: "QuickBooks disconnected" });
  } catch (err) {
    next(err);
  }
}
