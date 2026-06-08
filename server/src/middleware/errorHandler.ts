import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { isAppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getPgErrorCode, isDatabaseUnavailableError } from "../utils/pgErrors.js";

function databaseUnavailableMessage(pgCode: string | null): string {
  if (env.NODE_ENV === "production") {
    if (pgCode === "42P01" || pgCode === "3F000") {
      return "Database not ready. Migrations run automatically on deploy; redeploy the API service or contact admin.";
    }
    return "Database not ready. Link Postgres on Railway with DATABASE_URL, then redeploy so migrations run on boot.";
  }
  return "Database is not running. Run: pnpm dev (starts Postgres + API + frontend together).";
}

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

  if (isDatabaseUnavailableError(err)) {
    const pgCode = getPgErrorCode(err);
    logger.error("Database connection failed", { err, pgCode });
    res.status(503).json({
      error: databaseUnavailableMessage(pgCode),
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
