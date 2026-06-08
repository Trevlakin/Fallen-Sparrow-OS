/**
 * Extract Porter CSV from Resend inbound webhook payloads.
 */
import Busboy from "busboy";
import { Readable } from "node:stream";

function isCsvMime(mime: string | undefined, filename: string | undefined): boolean {
  if (mime === "text/csv" || mime === "application/csv") {
    return true;
  }
  return Boolean(filename?.toLowerCase().endsWith(".csv"));
}

export async function extractCsvFromMultipart(
  rawBody: Buffer,
  contentType: string,
): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let csv: string | null = null;

    const busboy = Busboy({
      headers: { "content-type": contentType },
    });

    busboy.on(
      "file",
      (
        _fieldname: string,
        file: NodeJS.ReadableStream,
        info: { mimeType: string; filename: string },
      ) => {
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

    busboy.on("finish", () => resolve(csv));
    busboy.on("error", reject);

    Readable.from(rawBody).pipe(busboy);
  });
}

export function extractCsvFromJsonBody(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }

  const root = body as Record<string, unknown>;
  const data =
    root["data"] && typeof root["data"] === "object"
      ? (root["data"] as Record<string, unknown>)
      : root;

  const attachments = data["attachments"];
  if (!Array.isArray(attachments)) {
    return null;
  }

  for (const att of attachments) {
    if (!att || typeof att !== "object") {
      continue;
    }
    const a = att as Record<string, unknown>;
    const filename = String(a["filename"] ?? a["name"] ?? "");
    const contentType = String(a["content_type"] ?? a["contentType"] ?? "");
    if (!isCsvMime(contentType, filename)) {
      continue;
    }

    const content = a["content"] ?? a["data"];
    if (typeof content === "string" && content.length > 0) {
      try {
        return Buffer.from(content, "base64").toString("utf8");
      } catch {
        return content;
      }
    }
  }

  return null;
}
