/**
 * Multipart receipt image extraction for upload endpoints.
 */
import Busboy from "busboy";
import type { Request } from "express";
import { AppError } from "./errors.js";

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function isReceiptMime(mime: string | undefined, filename: string | undefined): boolean {
  if (mime && ALLOWED_RECEIPT_TYPES.has(mime)) return true;
  const lower = filename?.toLowerCase() ?? "";
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".heic")
  );
}

function normalizeContentType(mime: string | undefined, filename: string | undefined): string {
  if (mime && ALLOWED_RECEIPT_TYPES.has(mime)) return mime;
  const lower = filename?.toLowerCase() ?? "";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic")) return "image/heic";
  return "image/jpeg";
}

export async function extractReceiptImageFromRequest(
  req: Request,
): Promise<{ buffer: Buffer; contentType: string }> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.includes("multipart/form-data")) {
    throw new AppError("Expected multipart/form-data upload", 400);
  }

  return new Promise((resolve, reject) => {
    let fileBuffer: Buffer | null = null;
    let fileContentType: string | null = null;

    const busboy = Busboy({ headers: { "content-type": contentType } });

    busboy.on(
      "file",
      (
        fieldname: string,
        file: NodeJS.ReadableStream,
        info: { mimeType: string; filename: string },
      ) => {
        if (fieldname !== "receipt" && fieldname !== "file") {
          file.resume();
          return;
        }
        if (!isReceiptMime(info.mimeType, info.filename)) {
          file.resume();
          return;
        }
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
          fileContentType = normalizeContentType(info.mimeType, info.filename);
        });
      },
    );

    busboy.on("finish", () => {
      if (!fileBuffer || fileBuffer.length === 0) {
        reject(new AppError("No receipt image found in upload", 400));
        return;
      }
      resolve({
        buffer: fileBuffer,
        contentType: fileContentType ?? "image/jpeg",
      });
    });

    busboy.on("error", reject);
    req.pipe(busboy);
  });
}
