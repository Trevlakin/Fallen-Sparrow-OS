/**
 * MASTER_SPEC_v3 §8.1 — Resend email + inbound webhook verification.
 * THE ONLY FILE that imports the 'resend' package.
 */
import crypto from "node:crypto";
import { Resend } from "resend";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let resendClient: Resend | null = null;

function getClient(): Resend | null {
  if (!env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export function hasWebhookSecret(): boolean {
  return Boolean(
    env.RESEND_INBOUND_WEBHOOK_SECRET &&
      env.RESEND_INBOUND_WEBHOOK_SECRET.length > 0,
  );
}

export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
): boolean {
  const secret = env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    return false;
  }

  const normalized = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const receivedBuf = Buffer.from(normalized, "hex");
    if (expectedBuf.length !== receivedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  const client = getClient();
  const from = params.from ?? env.RESEND_FROM_EMAIL;
  if (!client || !from) {
    logger.warn("Resend send skipped: RESEND_API_KEY or RESEND_FROM_EMAIL not set");
    return false;
  }

  try {
    const { error } = await client.emails.send({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    if (error) {
      logger.error("Resend send failed", { error });
      return false;
    }
    return true;
  } catch (err) {
    logger.error("Resend send threw", {
      message: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
