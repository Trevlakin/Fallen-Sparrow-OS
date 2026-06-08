/**
 * MASTER_SPEC_v3 §8 — Twilio SMS. THE ONLY FILE that imports the 'twilio' package.
 */
import twilio from "twilio";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let twilioClient: ReturnType<typeof twilio> | null = null;
let configured = false;

function isConfigured(): boolean {
  return Boolean(
    env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_PHONE_NUMBER,
  );
}

function getClient(): ReturnType<typeof twilio> | null {
  if (!isConfigured()) {
    return null;
  }
  if (!twilioClient) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!);
  }
  return twilioClient;
}

if (!isConfigured()) {
  logger.warn(
    "Twilio not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) — SMS nudges disabled",
  );
} else {
  configured = true;
  logger.info("Twilio SMS integration ready");
}

export async function sendSms(to: string, message: string): Promise<boolean> {
  const client = getClient();
  const from = env.TWILIO_PHONE_NUMBER;
  if (!client || !from) {
    logger.warn("Twilio send skipped: credentials or TWILIO_PHONE_NUMBER not set");
    return false;
  }

  try {
    await client.messages.create({
      body: message,
      from,
      to,
    });
    return true;
  } catch (err) {
    logger.error("Twilio send failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

export function isTwilioConfigured(): boolean {
  return configured;
}
