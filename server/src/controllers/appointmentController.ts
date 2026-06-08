import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import { AppError } from "../utils/errors.js";

const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD")
  .optional();

const listQuerySchema = z.object({
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  from: dateParamSchema,
  to: dateParamSchema,
});

function parseOptionalDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

function parseOptionalEndDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  return new Date(`${value}T23:59:59.999Z`);
}

export async function listAppointments(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError("Invalid query parameters", 400);
    }

    const { rows, total } = await appointmentRepo.listAppointments({
      search: parsed.data.search,
      page: parsed.data.page,
      limit: parsed.data.limit,
      from: parseOptionalDate(parsed.data.from),
      to: parseOptionalEndDate(parsed.data.to),
    });

    const limit = parsed.data.limit;
    const page = parsed.data.page;
    const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

    res.json({
      rows: rows.map((row) => ({
        id: row.id,
        serviceType: row.serviceType,
        artistId: row.artistId,
        artistName: row.artistName,
        customerId: row.customerId,
        customerName: row.customerName,
        totalRevenue: row.totalRevenue,
        artistPayout: row.artistPayout,
        appointmentDate: row.appointmentDate.toISOString().slice(0, 10),
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    next(err);
  }
}
