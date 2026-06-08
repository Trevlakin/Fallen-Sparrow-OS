import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { ARTIST_PAYOUT_METHODS } from "@fallen-sparrow/shared/constants";
import * as jarvisService from "../services/jarvisService.js";
import * as jarvisIntentRouter from "../services/jarvisIntentRouter.js";
import * as jarvisHistoryService from "../services/jarvisHistoryService.js";
import * as jarvisArtistPayoutService from "../services/jarvisArtistPayoutService.js";
import * as suggestionRepo from "../repos/suggestionRepo.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

function scheduleJarvisHistoryRecord(
  userId: string,
  rawText: string,
  responseBody: unknown,
): void {
  void jarvisHistoryService
    .recordJarvisRequest({
      authorUserId: userId,
      rawInput: rawText,
      inputType: "text",
      responseBody,
    })
    .catch((err: unknown) => {
      logger.warn("jarvis history record failed", { err, userId });
    });
}

const EMPTY_COMMITTED = {
  expenses: 0,
  incidents: 0,
  tasks: 0,
  strategicNotes: 0,
  inventoryUpdates: 0,
} as const;

const parseBodySchema = z.object({
  rawText: z.string().min(1),
  images: z
    .array(
      z.object({
        mediaType: z.string(),
        base64Data: z.string(),
      }),
    )
    .optional(),
});

export async function parseInput(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.studioContext) {
      throw new AppError("Authentication required", 401);
    }
    const parsed = parseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("rawText is required", 400);
    }

    const shopId = req.studioContext.studioId;
    const hasImages = Boolean(parsed.data.images?.length);

    if (!hasImages) {
      const routed = await jarvisIntentRouter.tryRouteJarvisByIntent(
        parsed.data.rawText,
        shopId,
        req.user.id,
        undefined,
        req.user.role,
      );
      if (routed) {
        const payload = {
          ...routed,
          committed: { ...EMPTY_COMMITTED },
          jarvisResponse: routed.message,
          ...(routed.type === "command_response" && routed.teamCommand
            ? { teamCommand: routed.teamCommand }
            : {}),
          ...(routed.type === "payout_proposal"
            ? { payoutProposal: routed.payoutProposal }
            : {}),
        };
        scheduleJarvisHistoryRecord(req.user.id, parsed.data.rawText, payload);
        res.json(payload);
        return;
      }
    }

    const [result, context] = await Promise.all([
      jarvisService.parseJarvisInput({
        shopId,
        userId: req.user.id,
        rawText: parsed.data.rawText,
        images: parsed.data.images,
      }),
      jarvisService.assembleJarvisContext(shopId),
    ]);

    let jarvisResponse = "";
    try {
      jarvisResponse = await jarvisService.generateJarvisResponse(
        result.rawParsed,
        context,
        result.committed,
      );
    } catch {
      jarvisResponse = "";
    }

    const payload = {
      committed: result.committed,
      suggestions: result.suggestions,
      jarvisResponse,
    };
    scheduleJarvisHistoryRecord(req.user.id, parsed.data.rawText, payload);
    res.json(payload);
  } catch (err) {
    next(err);
  }
}

export async function preview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.studioContext) {
      throw new AppError("Authentication required", 401);
    }
    const parsed = parseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("rawText is required", 400);
    }

    const shopId = req.studioContext.studioId;
    const hasImages = Boolean(parsed.data.images?.length);

    if (!hasImages) {
      const routed = await jarvisIntentRouter.tryRouteJarvisByIntent(
        parsed.data.rawText,
        shopId,
        req.user.id,
        undefined,
        req.user.role,
      );
      if (routed) {
        scheduleJarvisHistoryRecord(req.user.id, parsed.data.rawText, routed);
        res.json(routed);
        return;
      }
    }

    const result = await jarvisService.previewJarvisInput({
      rawText: parsed.data.rawText,
      images: parsed.data.images,
    });
    scheduleJarvisHistoryRecord(req.user.id, parsed.data.rawText, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const requests = await jarvisHistoryService.listHistoryForUser(req.user.id);
    res.json({ requests });
  } catch (err) {
    next(err);
  }
}

export async function deleteHistoryItem(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("History id required", 400);
    }
    const deleted = await jarvisHistoryService.deleteHistoryItem(req.user.id, id);
    if (!deleted) {
      throw new AppError("History entry not found", 404);
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

export async function clearHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const deleted = await jarvisHistoryService.clearHistoryForUser(req.user.id);
    res.json({ ok: true, deleted });
  } catch (err) {
    next(err);
  }
}

export async function approve(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user || !req.studioContext) {
      throw new AppError("Authentication required", 401);
    }
    const parsed = jarvisService.ApprovePayloadSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(`Invalid approval payload: ${parsed.error.message}`, 400);
    }
    const committed = await jarvisService.approveJarvisItems(req.user.id, parsed.data);
    res.json({ committed });
  } catch (err) {
    next(err);
  }
}

export async function listSuggestions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rows = await suggestionRepo.listPending();
    res.json({
      suggestions: rows.map((r) => ({
        id: r.id,
        brainDumpId: r.brainDumpId,
        proposedType: r.proposedType,
        rawText: r.rawText,
        parsedPayload: r.parsedPayload,
        aiConfidence: r.aiConfidence,
        status: r.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function promoteSuggestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Suggestion id required", 400);
    }
    await jarvisService.promoteSuggestion(id, req.user.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

const confirmPayoutBodySchema = z.object({
  artistId: z.string().uuid(),
  paymentIds: z.array(z.string().uuid()).min(1),
  payoutMethod: z.enum(ARTIST_PAYOUT_METHODS),
});

export async function confirmArtistPayout(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Authentication required", 401);
    }
    const body = confirmPayoutBodySchema.safeParse(req.body);
    if (!body.success) {
      throw new AppError("Invalid payout confirmation payload", 400);
    }
    const result = await jarvisArtistPayoutService.confirmArtistPayoutFromJarvis(
      body.data.artistId,
      body.data.paymentIds,
      body.data.payoutMethod,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function dismissSuggestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Suggestion id required", 400);
    }
    await jarvisService.dismissSuggestion(id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
