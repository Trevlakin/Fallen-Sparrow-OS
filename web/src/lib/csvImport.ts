export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

import { getApiBase } from "./apiBase.js";

const API_BASE = getApiBase();

export interface MappedCsvImportParams {
  csv: string;
  format: "expenses" | "appointments" | "porter";
  mapping: Record<string, string>;
  fileName?: string;
}

export async function postCsvImportMapped(
  params: MappedCsvImportParams,
): Promise<ImportResult> {
  const token = localStorage.getItem("fs_token");
  const res = await fetch(`${API_BASE}/api/import/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  const body = (await res.json()) as
    | ImportResult
    | { error?: string; message?: string; headers?: string[] };

  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body && typeof body.message === "string"
        ? body.message
        : typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
          ? body.error === "mapping_required"
            ? "Map your CSV columns before importing."
            : body.error
          : "Import failed";
    throw new Error(message);
  }

  return body as ImportResult;
}
