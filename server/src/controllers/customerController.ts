import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as customerContinuityService from "../services/customerContinuityService.js";
import * as referralService from "../services/referralService.js";
import * as customerRepo from "../repos/customerRepo.js";
import { AppError } from "../utils/errors.js";

const listQuerySchema = z.object({
  overdue: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const topReferrersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const bySpendQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

function studioId(req: Request): string {
  // shopId reserved for multi-location; single-tenant deployment ignores explicit shop scope.
  return req.studioContext?.studioId ?? "fallen-sparrow-kissimmee";
}

export async function listCustomers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: overdue must be true or false", 400);
    }

    if (parsed.data.overdue) {
      const candidates = await customerContinuityService.getNudgeCandidates(
        studioId(req),
      );
      res.json({ customers: candidates });
      return;
    }

    const customers = await customerContinuityService.listCustomerSummaries(
      studioId(req),
    );
    res.json({ customers });
  } catch (err) {
    next(err);
  }
}

export async function getCustomer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const customerId = z.string().uuid().safeParse(req.params["id"]);
    if (!customerId.success) {
      throw new AppError("Invalid customer id", 400);
    }
    const profile = await customerContinuityService.getCustomerContinuityProfile(
      customerId.data,
      studioId(req),
    );
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function getCustomersBySpend(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = bySpendQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: limit must be 1-100", 400);
    }
    const customers = await customerRepo.getCustomersByTotalSpend(parsed.data.limit);
    res.json({ customers });
  } catch (err) {
    next(err);
  }
}

export async function getTopReferrers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = topReferrersQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query: limit must be 1-100", 400);
    }
    const referrers = await referralService.getTopReferrers(parsed.data.limit);
    res.json({ referrers });
  } catch (err) {
    next(err);
  }
}
