import * as Sentry from "@sentry/node";
import { env, hasSentry } from "./config/env.js";
import { createApp } from "./app.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { logger } from "./utils/logger.js";
import { startAllJobs } from "./jobs/index.js";
import { backfillMissingPinPlaintext } from "./services/teamMemberService.js";
import { runMigrations } from "./db/migrate.js";

if (hasSentry() && env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
  });
  logger.info("Sentry initialized");
}

if (!env.RESEND_INBOUND_WEBHOOK_SECRET) {
  logger.warn(
    "RESEND_INBOUND_WEBHOOK_SECRET not set — Porter inbound webhook disabled until configured",
  );
}

if (!env.ANTHROPIC_API_KEY) {
  logger.warn(
    "ANTHROPIC_API_KEY not set — brain dump and briefing routes will fail until configured",
  );
}

const app = createApp();

if (hasSentry()) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

async function startServer(): Promise<void> {
  try {
    await runMigrations(env.DATABASE_URL);
  } catch (err: unknown) {
    logger.error("Database migrations failed on startup (API will still start)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  app.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`, {
      nodeEnv: env.NODE_ENV,
    });
    startAllJobs();
    void backfillMissingPinPlaintext().catch((err: unknown) => {
      logger.warn("PIN plaintext backfill failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  });
}

void startServer();
