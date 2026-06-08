/**
 * Cloudflare R2 (S3-compatible) receipt storage. Local disk fallback when R2 is not configured.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_RECEIPTS_ROOT = resolve(__dirname, "../../.data/receipts");

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME,
  );
}

function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
    case "image/heif":
      return ".heic";
    default:
      return ".jpg";
  }
}

function assertReceiptContentType(contentType: string): void {
  if (!ALLOWED_RECEIPT_TYPES.has(contentType)) {
    throw new AppError("Receipt must be a JPEG, PNG, or WebP image", 400);
  }
}

async function getR2Client() {
  if (!isR2Configured()) {
    throw new AppError("Receipt storage is not configured", 503);
  }
  try {
    const { S3Client } = await import("@aws-sdk/client-s3");
    return new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  } catch {
    throw new AppError(
      "R2 upload requires @aws-sdk/client-s3. Run pnpm install at the project root.",
      503,
    );
  }
}

async function uploadToLocalDisk(params: {
  studioId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const ext = extensionForContentType(params.contentType);
  const relativeKey = `${params.studioId}/${randomUUID()}${ext}`;
  const absolutePath = resolve(LOCAL_RECEIPTS_ROOT, relativeKey);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, params.buffer);
  return `/api/files/receipts/${relativeKey}`;
}

export async function uploadReceiptImage(params: {
  studioId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ receiptUrl: string; storage: "r2" | "local" }> {
  assertReceiptContentType(params.contentType);

  if (params.buffer.length > 8 * 1024 * 1024) {
    throw new AppError("Receipt image must be 8 MB or smaller", 400);
  }

  if (isR2Configured()) {
    const { uploadReceiptToR2 } = await import("./storageR2.js");
    const receiptUrl = await uploadReceiptToR2(params);
    return { receiptUrl, storage: "r2" };
  }

  const receiptUrl = await uploadToLocalDisk(params);
  return { receiptUrl, storage: "local" };
}

export function resolveLocalReceiptPath(relativeKey: string): string {
  const normalized = relativeKey.replace(/^\/+/, "").replace(/\.\./g, "");
  const absolute = resolve(LOCAL_RECEIPTS_ROOT, normalized);
  if (!absolute.startsWith(LOCAL_RECEIPTS_ROOT)) {
    throw new AppError("Invalid receipt path", 400);
  }
  return absolute;
}
