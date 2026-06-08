/**
 * R2 upload only. Loaded on demand so dev works without @aws-sdk/client-s3 installed.
 */
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

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

export async function uploadReceiptToR2(params: {
  studioId: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  let S3Client: typeof import("@aws-sdk/client-s3").S3Client;
  let PutObjectCommand: typeof import("@aws-sdk/client-s3").PutObjectCommand;

  try {
    const mod = await import("@aws-sdk/client-s3");
    S3Client = mod.S3Client;
    PutObjectCommand = mod.PutObjectCommand;
  } catch {
    throw new AppError(
      "R2 upload requires @aws-sdk/client-s3. Run pnpm install at the project root.",
      503,
    );
  }

  const ext = extensionForContentType(params.contentType);
  const key = `receipts/${params.studioId}/${randomUUID()}${ext}`;
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType,
    }),
  );

  if (env.R2_PUBLIC_URL) {
    const base = env.R2_PUBLIC_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  }
  return key;
}
