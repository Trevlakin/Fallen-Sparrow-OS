/**
 * Sprint 8Q: classify JARVIS input as LOG | QUERY | COMMAND before routing.
 */
import { z } from "zod";
import { callClaude } from "../integrations/anthropic.js";

export type JarvisIntent = "LOG" | "QUERY" | "COMMAND";

const IntentSchema = z.enum(["LOG", "QUERY", "COMMAND"]);

const ClassifierOutputSchema = z.object({
  intent: IntentSchema,
  confidence: z.number().min(0).max(1),
  subType: z.string().optional(),
  extractedParams: z.record(z.string(), z.unknown()).optional(),
});

export interface ClassifiedIntent {
  intent: JarvisIntent;
  confidence: number;
  subType?: string;
  extractedParams: Record<string, unknown>;
  originalInput: string;
}

const CLASSIFIER_SYSTEM_PROMPT = `You are an intent classifier for JARVIS, an AI operations assistant for Fallen Sparrow Tattoo Co.

Classify every user input into exactly one intent:

LOG - The user is providing information to store (events, expenses, incidents, notes, observations, sales, operational facts).

QUERY - The user is asking for information already in the system (reports, recaps, performance, financial summaries, SOP status, artist performance, appointment counts, expense breakdowns, comparisons, health checks).

COMMAND - The user wants a specific system action (change a PIN, add an employee, deactivate someone, sync QuickBooks expenses).

Respond ONLY with valid JSON (no markdown fences):
{
  "intent": "LOG" | "QUERY" | "COMMAND",
  "confidence": number between 0 and 1,
  "subType": string,
  "extractedParams": object
}

subType examples:
- QUERY: financial_recap, artist_performance, expense_query, sop_status, appointment_query, comparison, health_check, extra_task_query
- LOG: expense_log, artist_payout_log, incident_log, sale_log, staff_note, strategic_note
- COMMAND: pin_change, add_employee, deactivate_employee, quickbooks_sync

extractedParams for QUERY may include: month, year, period (today, yesterday, current_week, last_week, current_month, last_month, ytd, all_time), artist, metric, category.
Use period "current_month" when the user says "this month" or "how are we tracking".
Use lowercase month names in extractedParams.month when given (e.g. "may").

Examples:
"give me a recap of may" -> QUERY, financial_recap, month may
"carlos came in late today" -> LOG, incident_log
"change courtney's pin to 5555" -> COMMAND, pin_change
"sync quickbooks" -> COMMAND, quickbooks_sync
"pull from quickbooks" -> COMMAND, quickbooks_sync
"update expenses from qb" -> COMMAND, quickbooks_sync
"who's our top earner" -> QUERY, artist_performance, metric top_earner
"what SOPs were missed yesterday" -> QUERY, sop_status
"what extra tasks are open right now" -> QUERY, extra_task_query, period today
"how long did the AC thing take to resolve" -> QUERY, extra_task_query
"bought ink from eternal ink $180" -> LOG, expense_log
"spent $140 on sterilization pouches" -> LOG, expense_log
"AC repair cost $450 today" -> LOG, incident_log
"I have an idea for a Sunday night event" -> LOG, strategic_note
"paid Carlos $5376 via Zelle" -> LOG, artist_payout_log
"sent Riley 4836 on cash app" -> LOG, artist_payout_log
"gave Taylor $1740 cash for their sessions" -> LOG, artist_payout_log`;

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function fallbackLogIntent(input: string): ClassifiedIntent {
  return {
    intent: "LOG",
    confidence: 0.5,
    subType: "unknown",
    extractedParams: {},
    originalInput: input,
  };
}

export async function classifyIntent(input: string): Promise<ClassifiedIntent> {
  const trimmed = input.trim();
  if (!trimmed) {
    return fallbackLogIntent(input);
  }

  try {
    const raw = await callClaude({
      systemPrompt: CLASSIFIER_SYSTEM_PROMPT,
      userMessage: trimmed,
      maxTokens: 500,
    });
    const parsed = ClassifierOutputSchema.parse(
      JSON.parse(stripMarkdownFences(raw)),
    );
    return {
      intent: parsed.intent,
      confidence: parsed.confidence,
      subType: parsed.subType,
      extractedParams: parsed.extractedParams ?? {},
      originalInput: trimmed,
    };
  } catch {
    return fallbackLogIntent(trimmed);
  }
}
