import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { EXPENSE_CATEGORIES } from "@fallen-sparrow/shared/constants";
import { SCHEMA_SERVICE_TYPES } from "@fallen-sparrow/shared/serviceTypes";
import * as manualEntryRepo from "../repos/manualEntryRepo.js";
import * as manualSaleService from "../services/manualSaleService.js";
import * as authService from "../services/authService.js";
import { AppError } from "../utils/errors.js";

const categoryKeys = Object.keys(EXPENSE_CATEGORIES) as [
  keyof typeof EXPENSE_CATEGORIES,
  ...(keyof typeof EXPENSE_CATEGORIES)[],
];

const manualExpenseSchema = z.object({
  vendor: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.enum(categoryKeys),
  description: z.string().max(2000).default(""),
  expenseDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "expenseDate must be YYYY-MM-DD"),
});

export async function createManualExpense(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const parsed = manualExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
    }

    const expenseId = await manualEntryRepo.insertManualExpense({
      vendor: parsed.data.vendor,
      amount: parsed.data.amount,
      category: parsed.data.category,
      description: parsed.data.description,
      expenseDate: new Date(`${parsed.data.expenseDate}T12:00:00`),
      loggedByUserId: authService.resolveAuditUserId(req.authPayload),
    });

    res.json({ ok: true, expenseId });
  } catch (err) {
    next(err);
  }
}

const manualSaleSchema = z
  .object({
    appointmentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "appointmentDate must be YYYY-MM-DD"),
    artistId: z.string().uuid().optional(),
    artistName: z.string().max(200).optional(),
    clientName: z.string().min(1).max(200),
    serviceType: z.enum(SCHEMA_SERVICE_TYPES),
    totalRevenue: z.number().positive(),
    artistPayout: z.number().min(0).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => Boolean(data.artistId) || Boolean(data.artistName?.trim()), {
    message: "Select an artist or enter an artist name",
    path: ["artistId"],
  });

export async function createManualSale(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const parsed = manualSaleSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors[0]?.message ?? "Invalid request", 400);
    }

    const result = await manualSaleService.createManualSale({
      appointmentDate: new Date(`${parsed.data.appointmentDate}T12:00:00`),
      artistId: parsed.data.artistId,
      artistName: parsed.data.artistName,
      clientName: parsed.data.clientName,
      serviceType: parsed.data.serviceType,
      totalRevenue: parsed.data.totalRevenue,
      artistPayout: parsed.data.artistPayout,
      notes: parsed.data.notes,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

export async function listManualSaleArtists(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const artists = await manualSaleService.listArtistsForManualSale();
    res.json({ artists });
  } catch (err) {
    next(err);
  }
}
