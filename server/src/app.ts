import express, { type Express } from "express";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { porterWebhookRouter } from "./routes/porter.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { hasWebhookSecret } from "./integrations/resend.js";
import { logger } from "./utils/logger.js";

function getAllowedWebOrigins(): Set<string> {
  const origins = new Set<string>([env.WEB_APP_URL]);
  try {
    const u = new URL(env.WEB_APP_URL);
    if (u.hostname.startsWith("www.")) {
      origins.add(`${u.protocol}//${u.hostname.slice(4)}`);
    } else {
      origins.add(`${u.protocol}//www.${u.hostname}`);
    }
  } catch {
    /* keep only the configured value */
  }
  const extra = env.WEB_APP_ALLOWED_ORIGINS?.trim();
  if (extra) {
    for (const part of extra.split(",")) {
      const trimmed = part.trim();
      if (trimmed) {
        origins.add(trimmed);
      }
    }
  }
  return origins;
}

const allowedWebOrigins = getAllowedWebOrigins();

function isAllowedCorsOrigin(origin: string): boolean {
  if (allowedWebOrigins.has(origin)) {
    return true;
  }
  if (env.NODE_ENV !== "production") {
    return (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    );
  }
  return false;
}

export function createApp(): Express {
  const app = express();

  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    });
  });

  if (!hasWebhookSecret()) {
    logger.warn(
      "RESEND_INBOUND_WEBHOOK_SECRET not set — POST /api/porter/ingest/webhook returns 503",
    );
  }

  app.use(requestLogger);

  // Webhook must read raw body before JSON parser
  app.use("/api/porter", porterWebhookRouter);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isAllowedCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.json({ name: "Fallen Sparrow API", version: "0.1.0" });
  });

  app.use("/api", apiRouter);

  return app;
}
