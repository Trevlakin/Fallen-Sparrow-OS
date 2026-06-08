import type { JarvisPreview } from "./jarvisService.js";
import type { JarvisIntentResponseBase } from "./jarvisIntentRouter.js";
import * as jarvisRequestRepo from "../repos/jarvisRequestRepo.js";

export type JarvisHistoryIntent = "LOG" | "QUERY" | "COMMAND";

export interface JarvisHistoryItemDto {
  id: string;
  rawInput: string;
  intent: JarvisHistoryIntent;
  inputType: string;
  responsePreview: string | null;
  createdAt: string;
}

const PREVIEW_MAX = 240;
const RAW_INPUT_MAX = 500;

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function buildLogPreview(preview: JarvisPreview): string {
  const parts: string[] = [];
  if (preview.expenses.length) {
    parts.push(
      `${preview.expenses.length} expense${preview.expenses.length === 1 ? "" : "s"}`,
    );
  }
  if (preview.tasks.length) {
    parts.push(`${preview.tasks.length} task${preview.tasks.length === 1 ? "" : "s"}`);
  }
  if (preview.incidents.length) {
    parts.push(
      `${preview.incidents.length} incident${preview.incidents.length === 1 ? "" : "s"}`,
    );
  }
  if (preview.notes.length) {
    parts.push(`${preview.notes.length} note${preview.notes.length === 1 ? "" : "s"}`);
  }
  if (preview.inventoryUpdates.length) {
    parts.push(
      `${preview.inventoryUpdates.length} inventory update${preview.inventoryUpdates.length === 1 ? "" : "s"}`,
    );
  }
  if (preview.suggestions.length) {
    parts.push(
      `${preview.suggestions.length} suggestion${preview.suggestions.length === 1 ? "" : "s"}`,
    );
  }
  return parts.length ? parts.join(", ") : "Log preview (review before saving)";
}

function isIntentResponse(
  body: unknown,
): body is JarvisIntentResponseBase & { type?: string } {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return (
    record["intent"] === "QUERY" ||
    record["intent"] === "COMMAND" ||
    record["intent"] === "LOG"
  );
}

function isJarvisPreview(body: unknown): body is JarvisPreview {
  if (!body || typeof body !== "object") return false;
  const record = body as Record<string, unknown>;
  return Array.isArray(record["expenses"]) && Array.isArray(record["tasks"]);
}

interface ParseCommittedShape {
  expenses?: number;
  incidents?: number;
  tasks?: number;
  strategicNotes?: number;
  inventoryUpdates?: number;
}

function buildCommittedPreview(committed: ParseCommittedShape): string {
  const parts: string[] = [];
  if (committed.expenses) {
    parts.push(`${committed.expenses} expense${committed.expenses === 1 ? "" : "s"}`);
  }
  if (committed.incidents) {
    parts.push(`${committed.incidents} incident${committed.incidents === 1 ? "" : "s"}`);
  }
  if (committed.tasks) {
    parts.push(`${committed.tasks} task${committed.tasks === 1 ? "" : "s"}`);
  }
  if (committed.strategicNotes) {
    parts.push(
      `${committed.strategicNotes} note${committed.strategicNotes === 1 ? "" : "s"}`,
    );
  }
  if (committed.inventoryUpdates) {
    parts.push(
      `${committed.inventoryUpdates} inventory update${committed.inventoryUpdates === 1 ? "" : "s"}`,
    );
  }
  return parts.length ? `Logged ${parts.join(", ")}` : "Processed log request";
}

export function deriveHistoryFromResponse(body: unknown): {
  intent: JarvisHistoryIntent;
  responsePreview: string | null;
} {
  if (isIntentResponse(body)) {
    const intent = body.intent as JarvisHistoryIntent;
    const message =
      typeof body.message === "string" && body.message.trim()
        ? truncate(body.message, PREVIEW_MAX)
        : null;
    if (message) {
      return { intent, responsePreview: message };
    }
    if (intent === "LOG" && isJarvisPreview(body)) {
      return { intent: "LOG", responsePreview: buildLogPreview(body) };
    }
    return {
      intent,
      responsePreview:
        intent === "COMMAND" ? "Command executed" : "Query answered",
    };
  }

  if (isJarvisPreview(body)) {
    return { intent: "LOG", responsePreview: buildLogPreview(body) };
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (record["committed"] && typeof record["committed"] === "object") {
      const committed = record["committed"] as ParseCommittedShape;
      const jarvisResponse =
        typeof record["jarvisResponse"] === "string"
          ? record["jarvisResponse"].trim()
          : "";
      return {
        intent: "LOG",
        responsePreview: jarvisResponse
          ? truncate(jarvisResponse, PREVIEW_MAX)
          : buildCommittedPreview(committed),
      };
    }
  }

  return { intent: "LOG", responsePreview: null };
}

export async function recordJarvisRequest(input: {
  authorUserId: string;
  rawInput: string;
  inputType?: string;
  responseBody: unknown;
}): Promise<void> {
  const { intent, responsePreview } = deriveHistoryFromResponse(input.responseBody);
  await jarvisRequestRepo.insertJarvisRequest({
    authorUserId: input.authorUserId,
    rawInput: truncate(input.rawInput, RAW_INPUT_MAX),
    intent,
    inputType: input.inputType ?? "text",
    responsePreview,
  });
}

export async function listHistoryForUser(
  authorUserId: string,
): Promise<JarvisHistoryItemDto[]> {
  const rows = await jarvisRequestRepo.listByAuthor(authorUserId);
  return rows.map((row) => ({
    id: row.id,
    rawInput: row.rawInput,
    intent: row.intent as JarvisHistoryIntent,
    inputType: row.inputType,
    responsePreview: row.responsePreview,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function deleteHistoryItem(
  authorUserId: string,
  id: string,
): Promise<boolean> {
  return jarvisRequestRepo.deleteByIdForAuthor(id, authorUserId);
}

export async function clearHistoryForUser(authorUserId: string): Promise<number> {
  return jarvisRequestRepo.deleteAllForAuthor(authorUserId);
}
