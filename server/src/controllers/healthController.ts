import type { Request, Response, NextFunction } from "express";
import * as healthService from "../services/healthService.js";

export async function getReady(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const db = await healthService.getDatabaseReadyStatus();
    const statusCode = db.ready ? 200 : 503;
    res.status(statusCode).json({
      status: db.ready ? "ready" : "not_ready",
      database: db.ready ? "connected" : "unavailable",
      pgCode: db.pgCode,
      hint: db.hint,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}
