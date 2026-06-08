/**
 * MASTER_SPEC_v3 §5 — Anthropic Claude integration.
 * THE ONLY FILE that imports @anthropic-ai/sdk.
 */
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

function requireApiKey(): string {
  if (!env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY.length < 1) {
    throw new AppError(
      "ANTHROPIC_API_KEY is required for AI features",
      503,
    );
  }
  return env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: requireApiKey() });
  }
  return client;
}

type TextBlock = Anthropic.Messages.TextBlock;

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const textBlock = content.find(
    (block): block is TextBlock => block.type === "text",
  );
  if (!textBlock) {
    throw new AppError("Anthropic response contained no text block", 502);
  }
  return textBlock.text.trim();
}

export async function callClaude(params: {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const response = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.systemPrompt,
    messages: [{ role: "user", content: params.userMessage }],
  });

  return extractText(response.content);
}

export async function callClaudeWithImages(params: {
  systemPrompt: string;
  userMessage: string;
  images: {
    mediaType: "image/jpeg" | "image/png" | "image/webp";
    base64Data: string;
  }[];
  maxTokens?: number;
}): Promise<string> {
  const imageBlocks = params.images.map((img) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: img.mediaType,
      data: img.base64Data,
    },
  }));

  const response = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: params.maxTokens ?? 1024,
    system: params.systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          { type: "text", text: params.userMessage },
        ],
      },
    ],
  });

  return extractText(response.content);
}
