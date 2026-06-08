import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import * as csvImportService from "../services/csvImportService.js";
import * as pnlImportHistoryService from "../services/pnlImportHistoryService.js";
import * as porterIngestionService from "../services/porterIngestionService.js";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { getCsvImportPayload } from "../utils/csvUpload.js";

const expenseMappingSchema = z.object({
  date: z.string().min(1),
  vendor: z.string().min(1),
  amount: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
});

const appointmentMappingSchema = z.object({
  date: z.string().min(1),
  artistName: z.string().min(1),
  clientName: z.string().min(1),
  serviceType: z.string().min(1),
  totalRevenue: z.string().min(1),
  artistPayout: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const importBodySchema = z.object({
  csv: z.string().min(1),
  format: z.enum(["expenses", "appointments", "porter"]).optional(),
  mapping: z.record(z.string()).optional(),
  fileName: z.string().max(255).optional(),
});

async function recordPnlImportIfNeeded(
  format: "expenses" | "appointments" | "porter" | undefined,
  fileName: string | undefined,
  userId: string,
  result: csvImportService.ImportResult,
): Promise<void> {
  if (!format || format === "porter" || result.imported <= 0) return;
  const importType = format === "expenses" ? "expenses" : "sales";
  try {
    await pnlImportHistoryService.recordSuccessfulCsvImport({
      importType,
      fileName: fileName ?? "CSV import",
      importedByUserId: userId,
      result,
    });
  } catch (err) {
    logger.warn("Failed to record P&L import history", {
      importType,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

function mapPorterResult(
  result: porterIngestionService.IngestCsvResult,
): csvImportService.ImportResult {
  return {
    imported: result.upserted,
    skipped: result.skipped,
    errors: result.errors.map((reason, index) => ({
      row: index + 2,
      reason,
    })),
  };
}

function validateMappingColumns(
  csvString: string,
  mapping: Record<string, string>,
  requiredKeys: string[],
): void {
  const headers = csvImportService.listCsvHeaders(csvString);
  const headerSet = new Set(headers);
  for (const key of requiredKeys) {
    const col = mapping[key];
    if (!col || !headerSet.has(col)) {
      throw new AppError(`Mapped column "${col ?? key}" not found in CSV headers`, 400);
    }
  }
}

export async function importCsv(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const payload = await getCsvImportPayload(req);
    const parsed = importBodySchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(parsed.error.message, 400);
    }

    const { csv, format, mapping, fileName } = parsed.data;

    if (format === "expenses" && mapping) {
      const expenseMapping = expenseMappingSchema.parse(mapping);
      validateMappingColumns(csv, expenseMapping, [
        "date",
        "vendor",
        "amount",
        "category",
      ]);
      const result = await csvImportService.importExpensesCsvWithMapping(
        csv,
        expenseMapping,
        req.user.id,
      );
      await recordPnlImportIfNeeded(format, fileName, req.user.id, result);
      res.json(result);
      return;
    }

    if (format === "appointments" && mapping) {
      const appointmentMapping = appointmentMappingSchema.parse(mapping);
      validateMappingColumns(csv, appointmentMapping, [
        "date",
        "artistName",
        "clientName",
        "serviceType",
        "totalRevenue",
      ]);
      const result = await csvImportService.importAppointmentsCsvWithMapping(
        csv,
        appointmentMapping,
      );
      await recordPnlImportIfNeeded(format, fileName, req.user.id, result);
      res.json(result);
      return;
    }

    if (format === "porter") {
      const result = await porterIngestionService.ingestCsv(csv);
      res.json(mapPorterResult(result));
      return;
    }

    const headers = csvImportService.listCsvHeaders(csv);
    const detected = csvImportService.detectCsvFormat(headers);

    switch (detected) {
      case "appointments": {
        const result = await csvImportService.importAppointmentsCsv(csv);
        await recordPnlImportIfNeeded("appointments", fileName, req.user.id, result);
        res.json(result);
        return;
      }
      case "expenses": {
        const result = await csvImportService.importExpensesCsv(csv, req.user.id);
        await recordPnlImportIfNeeded("expenses", fileName, req.user.id, result);
        res.json(result);
        return;
      }
      case "porter": {
        const result = await porterIngestionService.ingestCsv(csv);
        res.json(mapPorterResult(result));
        return;
      }
      default:
        res.status(400).json({
          error: "mapping_required",
          message:
            "Map your CSV columns before importing. Choose which column holds each field.",
          headers,
        });
    }
  } catch (err) {
    next(err);
  }
}

export async function previewCsvHeaders(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { csv } = await getCsvImportPayload(req);
    const { headers, rows } = csvImportService.parseCsvPreview(csv, 5);
    res.json({ headers, previewRows: rows });
  } catch (err) {
    next(err);
  }
}
