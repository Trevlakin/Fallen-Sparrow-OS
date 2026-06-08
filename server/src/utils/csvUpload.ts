/**
 * CSV upload helper for import endpoints (Sprint 8H).
 */
import Busboy from "busboy";
import type { Request } from "express";
import { AppError } from "./errors.js";

export interface CsvImportPayload {
  csv: string;
  format?: "expenses" | "appointments" | "porter";
  mapping?: Record<string, string>;
}

function isCsvMime(mime: string | undefined, filename: string | undefined): boolean {
  if (mime === "text/csv" || mime === "application/csv") {
    return true;
  }
  return Boolean(filename?.toLowerCase().endsWith(".csv"));
}

function parseMappingField(value: string | undefined): Record<string, string> | undefined {
  if (!value?.trim()) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("mapping must be a JSON object");
    }
    const out: Record<string, string> = {};
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === "string") {
        out[key] = val;
      }
    }
    return out;
  } catch {
    throw new AppError("Invalid mapping JSON", 400);
  }
}

export async function extractCsvFromMultipartRequest(
  req: Request,
): Promise<CsvImportPayload> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.includes("multipart/form-data")) {
    throw new AppError("Expected multipart/form-data upload", 400);
  }

  return new Promise((resolve, reject) => {
    let csv: string | null = null;
    let fieldCsv: string | null = null;
    let format: CsvImportPayload["format"];
    let mapping: Record<string, string> | undefined;

    const busboy = Busboy({ headers: { "content-type": contentType } });

    busboy.on("field", (name, value) => {
      if (name === "csv" && typeof value === "string" && value.trim().length > 0) {
        fieldCsv = value;
      }
      if (name === "format" && typeof value === "string") {
        if (value === "expenses" || value === "appointments" || value === "porter") {
          format = value;
        }
      }
      if (name === "mapping" && typeof value === "string") {
        try {
          mapping = parseMappingField(value);
        } catch (err) {
          reject(err);
        }
      }
    });

    busboy.on(
      "file",
      (
        fieldname: string,
        file: NodeJS.ReadableStream,
        info: { mimeType: string; filename: string },
      ) => {
        if (fieldname !== "file" && fieldname !== "csv") {
          file.resume();
          return;
        }
        if (!isCsvMime(info.mimeType, info.filename)) {
          file.resume();
          return;
        }
        const chunks: Buffer[] = [];
        file.on("data", (chunk: Buffer) => chunks.push(chunk));
        file.on("end", () => {
          csv = Buffer.concat(chunks).toString("utf8");
        });
      },
    );

    busboy.on("finish", () => {
      const result = csv ?? fieldCsv;
      if (!result || result.trim().length === 0) {
        reject(new AppError("No CSV file found in upload", 400));
        return;
      }
      resolve({ csv: result, format, mapping });
    });
    busboy.on("error", reject);

    req.pipe(busboy);
  });
}

export async function getCsvImportPayload(req: Request): Promise<CsvImportPayload> {
  const contentType = String(req.headers["content-type"] ?? "");
  if (contentType.includes("multipart/form-data")) {
    return extractCsvFromMultipartRequest(req);
  }

  const body = req.body as {
    csv?: unknown;
    format?: unknown;
    mapping?: unknown;
  };

  if (typeof body?.csv === "string" && body.csv.trim().length > 0) {
    const format =
      body.format === "expenses" ||
      body.format === "appointments" ||
      body.format === "porter"
        ? body.format
        : undefined;

    let mapping: Record<string, string> | undefined;
    if (body.mapping && typeof body.mapping === "object" && !Array.isArray(body.mapping)) {
      mapping = {};
      for (const [key, val] of Object.entries(body.mapping)) {
        if (typeof val === "string") {
          mapping[key] = val;
        }
      }
    }

    return { csv: body.csv, format, mapping };
  }

  throw new AppError(
    "CSV required: upload a file or provide { csv, format?, mapping? }",
    400,
  );
}

/** @deprecated Use getCsvImportPayload */
export async function getCsvFromRequest(req: Request): Promise<string> {
  const payload = await getCsvImportPayload(req);
  return payload.csv;
}
