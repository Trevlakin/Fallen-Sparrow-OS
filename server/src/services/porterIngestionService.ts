/**
 * MASTER_SPEC_v3 §8 — PorterIngestionService (Zapier CSV path).
 */
import { parse } from "csv-parse/sync";
import { meta, porterImportLog } from "@fallen-sparrow/shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import { mapPorterRow } from "../integrations/mapPorterRow.js";
import type {
  NormalizedPorterAppointment,
  PorterCsvRow,
} from "../integrations/porterTypes.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as customerRepo from "../repos/customerRepo.js";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import * as paymentRepo from "../repos/paymentRepo.js";
import * as settingsService from "./settingsService.js";
import { recomputeCustomerStats } from "./customerContinuityService.js";
import { logger } from "../utils/logger.js";
import * as followupService from "./followupService.js";

export interface IngestCsvResult {
  recordCount: number;
  upserted: number;
  skipped: number;
  errors: string[];
}

function parseCsvContent(csvText: string): PorterCsvRow[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as PorterCsvRow[];
  return records;
}

async function resolveCommissionPercentage(totalRevenue: number): Promise<string> {
  const { artistPct } = await settingsService.getSessionCommissionRate(totalRevenue);
  return artistPct.toFixed(4);
}

async function ingestNormalizedRow(
  row: NormalizedPorterAppointment,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const artist = await artistRepo.upsertArtistByPorterId(row.porterArtistId, {
      name: row.artistName,
      commissionPercentage: "0.5000", // artist row default; payout uses settings at payment time
      isActive: true,
    });

    const customer = await customerRepo.upsertCustomerByPorterId(
      row.porterClientId,
      { name: row.clientName },
    );

    const appointment = await appointmentRepo.upsertAppointment(
      row.porterAppointmentId,
      {
        customerId: customer.id,
        artistId: artist.id,
        serviceType: row.serviceType,
        status: row.status,
        appointmentDate: new Date(row.appointmentDate),
        completedDate: row.completedDate
          ? new Date(row.completedDate)
          : null,
        depositCollected: row.depositAmount > 0,
        notes: row.notes ?? null,
      },
    );

    if (row.status === "completed" && row.totalRevenue > 0) {
      const commissionPct = await resolveCommissionPercentage(row.totalRevenue);
      const payout = (row.totalRevenue * Number.parseFloat(commissionPct)).toFixed(
        2,
      );

      await paymentRepo.upsertPaymentForAppointment(appointment.id, {
        appointmentId: appointment.id,
        artistId: artist.id,
        customerId: customer.id,
        serviceType: row.serviceType,
        depositAmount: row.depositAmount.toFixed(2),
        finalAmount: row.finalAmount.toFixed(2),
        tipAmount: row.tipAmount.toFixed(2),
        totalRevenue: row.totalRevenue.toFixed(2),
        commissionPercentage: commissionPct,
        artistPayout: payout,
        paymentMethod: row.paymentMethod ?? null,
        paymentDate: row.completedDate
          ? new Date(row.completedDate)
          : new Date(row.appointmentDate),
      });

      await followupService.scheduleFollowUpsForCompletedAppointment({
        clientName: row.clientName,
        clientPhone: customer.phone,
        artistId: artist.id,
        appointmentDate: row.completedDate
          ? new Date(row.completedDate)
          : new Date(row.appointmentDate),
      });
    }

    await recomputeCustomerStats(customer.id);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown ingest error";
    return { ok: false, error: message };
  }
}

export async function ingestCsv(csvText: string): Promise<IngestCsvResult> {
  const rows = parseCsvContent(csvText);
  const errors: string[] = [];
  let upserted = 0;
  let skipped = 0;

  for (const raw of rows) {
    const normalized = mapPorterRow(raw);
    if (!normalized) {
      skipped += 1;
      errors.push("Skipped row: missing required Porter id fields");
      continue;
    }
    const result = await ingestNormalizedRow(normalized);
    if (result.ok) {
      upserted += 1;
    } else {
      skipped += 1;
      errors.push(result.error ?? "Ingest failed");
    }
  }

  const status =
    errors.length === 0
      ? "success"
      : upserted > 0
        ? "partial"
        : "failed";

  await db.insert(porterImportLog).values({
    recordCount: rows.length,
    sourceMethod: "zapier_csv",
    status,
    errors,
  });

  const metaRows = await db.select().from(meta).limit(1);
  if (metaRows[0]) {
    await db
      .update(meta)
      .set({ lastPorterImport: new Date(), updatedAt: new Date() })
      .where(eq(meta.id, metaRows[0].id));
  } else {
    await db.insert(meta).values({ lastPorterImport: new Date() });
  }

  logger.info("Porter CSV ingest complete", {
    recordCount: rows.length,
    upserted,
    skipped,
    status,
  });

  return {
    recordCount: rows.length,
    upserted,
    skipped,
    errors,
  };
}

/** Upgrade path when Porter API is confirmed (MASTER_SPEC_v3 §8.2). */
export async function ingestViaApi(
  _appointments: NormalizedPorterAppointment[],
): Promise<IngestCsvResult> {
  // TODO(Q1d): Implement when Porter API credentials and field mapping are confirmed.
  throw new Error("Porter API ingestion not available until Q1d is resolved");
}
