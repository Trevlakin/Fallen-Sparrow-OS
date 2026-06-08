import { desc, eq } from "drizzle-orm";
import { pnlImportHistory } from "@fallen-sparrow/shared/schema";
import { db } from "../config/database.js";

export type PnlImportHistoryRow = typeof pnlImportHistory.$inferSelect;

export type PnlImportType = "expenses" | "sales";

const LIST_LIMIT = 50;

export async function insertPnlImportHistory(values: {
  importType: PnlImportType;
  fileName: string;
  rowCount: number;
  skippedCount: number;
  importedByUserId: string;
  summaryStats?: { errorCount?: number };
}): Promise<PnlImportHistoryRow> {
  const [row] = await db
    .insert(pnlImportHistory)
    .values({
      importType: values.importType,
      fileName: values.fileName,
      rowCount: values.rowCount,
      skippedCount: values.skippedCount,
      importedByUserId: values.importedByUserId,
      summaryStats: values.summaryStats ?? null,
    })
    .returning();
  if (!row) {
    throw new Error("Failed to insert P&L import history");
  }
  return row;
}

export async function listPnlImportHistory(params: {
  importType?: PnlImportType;
  limit?: number;
}): Promise<PnlImportHistoryRow[]> {
  const limit = Math.min(Math.max(params.limit ?? LIST_LIMIT, 1), 100);
  const base = db
    .select()
    .from(pnlImportHistory)
    .orderBy(desc(pnlImportHistory.createdAt))
    .limit(limit);

  if (params.importType) {
    return base.where(eq(pnlImportHistory.importType, params.importType));
  }
  return base;
}

export async function deletePnlImportHistoryById(id: string): Promise<boolean> {
  const deleted = await db
    .delete(pnlImportHistory)
    .where(eq(pnlImportHistory.id, id))
    .returning({ id: pnlImportHistory.id });
  return deleted.length > 0;
}
