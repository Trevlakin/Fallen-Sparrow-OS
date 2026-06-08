import type { ImportResult } from "./csvImportService.js";
import * as pnlImportHistoryRepo from "../repos/pnlImportHistoryRepo.js";

export type PnlImportType = pnlImportHistoryRepo.PnlImportType;

export interface PnlImportHistoryDto {
  id: string;
  importType: PnlImportType;
  fileName: string;
  rowCount: number;
  skippedCount: number;
  importedByUserId: string;
  summaryStats: { errorCount?: number } | null;
  createdAt: string;
}

function toDto(row: pnlImportHistoryRepo.PnlImportHistoryRow): PnlImportHistoryDto {
  return {
    id: row.id,
    importType: row.importType as PnlImportType,
    fileName: row.fileName,
    rowCount: row.rowCount,
    skippedCount: row.skippedCount,
    importedByUserId: row.importedByUserId,
    summaryStats: row.summaryStats ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function recordSuccessfulCsvImport(params: {
  importType: PnlImportType;
  fileName: string;
  importedByUserId: string;
  result: ImportResult;
}): Promise<void> {
  if (params.result.imported <= 0) return;

  await pnlImportHistoryRepo.insertPnlImportHistory({
    importType: params.importType,
    fileName: params.fileName.trim() || "CSV import",
    rowCount: params.result.imported,
    skippedCount: params.result.skipped,
    importedByUserId: params.importedByUserId,
    summaryStats: { errorCount: params.result.errors.length },
  });
}

export async function listImports(params: {
  importType?: PnlImportType;
}): Promise<PnlImportHistoryDto[]> {
  const rows = await pnlImportHistoryRepo.listPnlImportHistory({
    importType: params.importType,
  });
  return rows.map(toDto);
}

export async function deleteImport(id: string): Promise<boolean> {
  return pnlImportHistoryRepo.deletePnlImportHistoryById(id);
}
