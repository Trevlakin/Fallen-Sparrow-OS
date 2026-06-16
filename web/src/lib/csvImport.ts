export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  duplicates?: number;
  pending?: number;
  dateRange?: { from: string; to: string } | null;
  artists?: string[];
}

import { getApiBase } from "./apiBase.js";

const API_BASE = getApiBase();

export interface MappedCsvImportParams {
  csv: string;
  format: "expenses" | "appointments" | "porter" | "porter-transactions";
  mapping: Record<string, string>;
  fileName?: string;
}

async function postCsvImportBody(body: Record<string, unknown>): Promise<ImportResult> {
  const token = localStorage.getItem("fs_token");
  const res = await fetch(`${API_BASE}/api/import/csv`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as
    | ImportResult
    | { error?: string; message?: string; headers?: string[] };

  if (!res.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data && typeof data.message === "string"
        ? data.message
        : typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
          ? data.error === "mapping_required"
            ? "Map your CSV columns before importing."
            : data.error
          : "Import failed";
    throw new Error(message);
  }

  return data as ImportResult;
}

export async function postCsvImportMapped(
  params: MappedCsvImportParams,
): Promise<ImportResult> {
  return postCsvImportBody({ ...params });
}

export async function postPorterTransactionsCsv(
  csv: string,
  fileName?: string,
): Promise<ImportResult> {
  return postCsvImportBody({
    csv,
    format: "porter-transactions",
    fileName,
  });
}
