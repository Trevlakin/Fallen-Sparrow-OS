import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as incidentService from "../services/incidentService.js";
import { AppError } from "../utils/errors.js";

const statusQuerySchema = z.enum(["open", "in_progress", "completed", "all"]).optional();

const resolveBodySchema = z.object({
  resolution: z.string().optional(),
});

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = statusQuerySchema.safeParse(req.query["status"]);
    const status = parsed.success ? parsed.data : undefined;
    const incidents = await incidentService.listIncidents(status ?? "all");
    res.json({ incidents });
  } catch (err) {
    next(err);
  }
}

export async function resolve(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Incident id required", 400);
    }
    const body = resolveBodySchema.safeParse(req.body);
    const resolution = body.success ? body.data.resolution : undefined;
    const incident = await incidentService.resolveIncident(id, resolution);
    res.json({ incident });
  } catch (err) {
    next(err);
  }
}

export async function reopen(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Incident id required", 400);
    }
    const incident = await incidentService.reopenIncident(id);
    res.json({ incident });
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = req.params["id"];
    if (!id || Array.isArray(id)) {
      throw new AppError("Incident id required", 400);
    }
    await incidentService.deleteIncident(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
