import type { Request, Response, NextFunction } from "express";
import { isAppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
    });
    return;
  }

  const pgCode =
    err &&
    typeof err === "object" &&
    "cause" in err &&
    err.cause &&
    typeof err.cause === "object" &&
    "code" in err.cause
      ? String((err.cause as { code?: string }).code)
      : null;

  if (pgCode === "ECONNREFUSED" || pgCode === "ENOTFOUND") {
    logger.error("Database connection failed", { err });
    res.status(503).json({
      error:
        "Database is not running. Run: pnpm dev (starts Postgres + API + frontend together).",
      statusCode: 503,
    });
    return;
  }

  logger.error("Unhandled error", { err });
  res.status(500).json({
    error: "Internal server error",
    statusCode: 500,
  });
}
