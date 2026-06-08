/**
 * MASTER_SPEC_v3 + 03-architecture — Zod-validated env; fails fast at boot.
 * Sprint 1 requires core + database + auth only; other keys optional until their sprint.
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../../.env") });

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DEFAULT_TIMEZONE: z.string().default("America/New_York"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
});

const optionalSprintSchema = z.object({
  ANTHROPIC_API_KEY: z
    .string()
    .min(1, "ANTHROPIC_API_KEY is required for AI features")
    .optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  PORTER_INBOUND_EMAIL: z.string().optional(),
  RESEND_INBOUND_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  QBO_CLIENT_ID: z.string().optional(),
  QBO_CLIENT_SECRET: z.string().optional(),
  QBO_REDIRECT_URI: z.string().optional(),
  QBO_ENVIRONMENT: z.enum(["sandbox", "production"]).optional(),
  QBO_REALM_ID: z.string().optional(),
  WEB_APP_URL: z.string().url().default("http://localhost:5173"),
  /** Comma-separated extra frontend origins allowed in production CORS (e.g. www + apex). */
  WEB_APP_ALLOWED_ORIGINS: z.string().optional(),
  BRIEFING_RECIPIENT_EMAIL: z.string().email().optional(),
  BRIEFING_SEND_HOUR: z.coerce.number().int().min(0).max(23).default(6),
  WEEKLY_REPORT_DAY: z.coerce.number().int().min(0).max(6).default(5),
  WEEKLY_REPORT_HOUR: z.coerce.number().int().min(0).max(23).default(17),
});

const envSchema = baseSchema.merge(optionalSprintSchema);

function parseEnv(): z.infer<typeof envSchema> {
  const raw = { ...process.env };
  if (raw["SENTRY_DSN"] === "") {
    delete raw["SENTRY_DSN"];
  }
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.flatten().fieldErrors;
    console.error("Invalid environment configuration:", formatted);
    process.exit(1);
  }
  return result.data;
}

export const env = parseEnv();

export type Env = typeof env;

export function hasSentry(): boolean {
  return Boolean(env.SENTRY_DSN && env.SENTRY_DSN.length > 0);
}

export function hasBriefingRecipient(): boolean {
  return Boolean(env.BRIEFING_RECIPIENT_EMAIL?.length);
}

export function hasQuickBooksConfig(): boolean {
  return Boolean(
    env.QBO_CLIENT_ID?.length &&
      env.QBO_CLIENT_SECRET?.length &&
      env.QBO_REDIRECT_URI?.length &&
      env.QBO_ENVIRONMENT,
  );
}
