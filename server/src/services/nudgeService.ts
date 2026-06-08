/**
 * MASTER_SPEC_v3 §6.3 — Customer continuity nudges (SMS via Twilio, email via Resend).
 */
import { NUDGE_RULES } from "@fallen-sparrow/shared/constants";
import * as customerRepo from "../repos/customerRepo.js";
import * as nudgeRepo from "../repos/nudgeRepo.js";
import * as twilioIntegration from "../integrations/twilio.js";
import * as customerContinuityService from "./customerContinuityService.js";
import * as emailService from "./emailService.js";
import { AppError } from "../utils/errors.js";

export async function listNudgeCandidates(shopId: string) {
  return customerContinuityService.getNudgeCandidates(shopId);
}

export async function markNudgeResonated(nudgeId: string) {
  const existing = await nudgeRepo.findNudgeById(nudgeId);
  if (!existing) {
    throw new AppError("Nudge not found", 404);
  }
  return nudgeRepo.markNudgeResonated(nudgeId);
}

export type SendNudgeResult = {
  nudgeId: string;
  message: string;
  status: "sent" | "failed";
  channel: "sms" | "email";
};

/**
 * Sends a warm reconnect nudge when eligible (30-day guard via continuity rules).
 * Pending nudges have sentAt=null until delivery succeeds.
 */
export async function sendNudge(
  shopId: string,
  customerId: string,
  channel: "sms" | "email" = "sms",
): Promise<SendNudgeResult> {
  const customer = await customerRepo.findCustomerById(customerId);
  if (!customer) {
    throw new AppError("Customer not found", 404);
  }

  const candidates = await customerContinuityService.getNudgeCandidates(shopId);
  const candidate = candidates.find((c) => c.customerId === customerId);
  if (!candidate) {
    throw new AppError(
      `Customer is not eligible for a nudge (overdue window or within ${NUDGE_RULES.minDaysBetweenNudges} days of last nudge)`,
      422,
    );
  }

  const message = candidate.suggestedMessage;

  const nudge = await nudgeRepo.insertNudge({
    customerId,
    reason: "friendly_reconnect",
    message,
    channel,
    sentAt: null,
  });

  let delivered = false;
  if (channel === "sms") {
    if (!customer.phone) {
      await nudgeRepo.deleteNudge(nudge.id);
      throw new AppError("Customer has no phone number on file", 422);
    }
    delivered = await twilioIntegration.sendSms(customer.phone, message);
  } else {
    if (!customer.email) {
      await nudgeRepo.deleteNudge(nudge.id);
      throw new AppError("Customer has no email on file", 422);
    }
    delivered = await emailService.sendNudgeEmail({
      to: customer.email,
      customerName: customer.name,
      message,
    });
  }

  if (!delivered) {
    return {
      nudgeId: nudge.id,
      message,
      status: "failed",
      channel,
    };
  }

  await nudgeRepo.updateNudgeSentAt(nudge.id, new Date());

  return {
    nudgeId: nudge.id,
    message,
    status: "sent",
    channel,
  };
}

/** @deprecated Use sendNudge — kept for transitional imports */
export const sendNudgeStub = sendNudge;
