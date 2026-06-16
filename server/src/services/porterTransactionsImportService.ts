/**
 * Porter Appointment Transactions CSV import (Settings / P&L sales upload).
 */
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import { getTodayEastern, parsePorterAppointmentDateTime } from "@fallen-sparrow/shared/dates";
import {
  findPorterDataStart,
  inferServiceTypeFromPorterArtist,
  isPorterAppointmentTransactionsExport,
  PORTER_TRANSACTIONS_COLUMNS,
} from "@fallen-sparrow/shared/porterCsv";
import { toSchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import * as artistRepo from "../repos/artistRepo.js";
import * as customerRepo from "../repos/customerRepo.js";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import * as paymentRepo from "../repos/paymentRepo.js";
import { recomputeCustomerStats } from "./customerContinuityService.js";
import * as followupService from "./followupService.js";
import type { ImportResult } from "./csvImportService.js";
import * as settingsService from "./settingsService.js";
import { getCommissionRate } from "@fallen-sparrow/shared/constants";

export interface PorterTransactionsImportResult extends ImportResult {
  duplicates: number;
  pending: number;
  dateRange: { from: string; to: string } | null;
  artists: string[];
}

interface ParsedPorterTransactionRow {
  artistName: string;
  clientName: string;
  appointmentDate: Date;
  totalCash: number;
  totalDigital: number;
  totalCredit: number;
  totalGiftCard: number;
  tip: number;
  artistPayout: number;
  shopPayout: number;
  salesTax: number;
  refundedAmount: number;
  voidedAmount: number;
  totalRevenue: number;
  serviceType: ReturnType<typeof inferServiceTypeFromPorterArtist>;
  status: "completed" | "scheduled";
}

function parseCsvToRows(csvString: string): { headers: string[]; rows: string[][] } {
  const records = parse(csvString, {
    columns: false,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as string[][];

  if (records.length === 0) {
    return { headers: [], rows: [] };
  }

  const [headers, ...rows] = records;
  return { headers: headers ?? [], rows };
}

function headerIndex(headers: string[], columnName: string): number {
  const target = columnName.trim().toLowerCase();
  return headers.findIndex((h) => h.trim().toLowerCase() === target);
}

function getCell(row: string[], headers: string[], columnName: string): string {
  const idx = headerIndex(headers, columnName);
  if (idx < 0) {
    return "";
  }
  return (row[idx] ?? "").trim();
}

function parsePorterAmount(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) {
    return 0;
  }
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function hasImportablePayment(row: ParsedPorterTransactionRow): boolean {
  return (
    row.totalCash > 0 ||
    row.totalDigital > 0 ||
    row.totalCredit > 0 ||
    row.totalGiftCard > 0 ||
    row.artistPayout > 0 ||
    row.shopPayout > 0
  );
}

function parsePorterTransactionRow(
  row: string[],
  headers: string[],
): { parsed: ParsedPorterTransactionRow | null; error: string | null } {
  const c = PORTER_TRANSACTIONS_COLUMNS;
  const artistName = getCell(row, headers, c.artist);
  const clientName = getCell(row, headers, c.customer);
  const appointmentDate = parsePorterAppointmentDateTime(getCell(row, headers, c.aptDate));

  if (!artistName || !clientName) {
    return { parsed: null, error: "Missing Artist or Customer" };
  }
  if (!appointmentDate) {
    return { parsed: null, error: "Invalid Apt. Date" };
  }

  const totalCash = parsePorterAmount(getCell(row, headers, c.totalCash));
  const totalDigital = parsePorterAmount(getCell(row, headers, c.totalDigital));
  const totalCredit = parsePorterAmount(getCell(row, headers, c.totalCredit));
  const totalGiftCard = parsePorterAmount(getCell(row, headers, c.totalGiftCard));
  const tip = parsePorterAmount(getCell(row, headers, c.tip));
  const artistPayout = parsePorterAmount(getCell(row, headers, c.artistPayout));
  const shopPayout = parsePorterAmount(getCell(row, headers, c.shopPayout));
  const salesTax = parsePorterAmount(getCell(row, headers, c.salesTax));
  const refundedAmount = parsePorterAmount(getCell(row, headers, c.refundedAmount));
  const voidedAmount = parsePorterAmount(getCell(row, headers, c.voidedAmount));
  const totalRevenue = totalCash + totalDigital + totalCredit + totalGiftCard;

  const todayEastern = getTodayEastern();
  const appointmentDay = appointmentDate.toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const isFuture = appointmentDay > todayEastern;

  const parsed: ParsedPorterTransactionRow = {
    artistName,
    clientName,
    appointmentDate,
    totalCash,
    totalDigital,
    totalCredit,
    totalGiftCard,
    tip,
    artistPayout,
    shopPayout,
    salesTax,
    refundedAmount,
    voidedAmount,
    totalRevenue,
    serviceType: inferServiceTypeFromPorterArtist(artistName),
    status: isFuture ? "scheduled" : "completed",
  };

  if (!hasImportablePayment(parsed)) {
    return { parsed: null, error: null };
  }

  return { parsed, error: null };
}

async function findOrCreateArtist(name: string) {
  const trimmed = name.trim() || "Unknown Artist";
  const existing = await artistRepo.findArtistByName(trimmed);
  if (existing) {
    return existing;
  }
  return artistRepo.createArtist({
    name: trimmed,
    commissionPercentage: "0.6000",
    isActive: true,
  });
}

async function findOrCreateCustomer(name: string) {
  const trimmed = name.trim() || "Unknown Client";
  const existing = await customerRepo.findCustomerByName(trimmed);
  if (existing) {
    return existing;
  }
  return customerRepo.createCustomer({ name: trimmed });
}

function formatDateRange(dates: Date[]): { from: string; to: string } | null {
  if (dates.length === 0) {
    return null;
  }
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  return { from: fmt(first), to: fmt(last) };
}

export function preparePorterTransactionsCsv(rawText: string): string {
  if (isPorterAppointmentTransactionsExport(rawText)) {
    return findPorterDataStart(rawText);
  }
  return rawText;
}

export { isPorterAppointmentTransactionsExport };

export async function importPorterTransactionsCsv(
  rawCsv: string,
): Promise<PorterTransactionsImportResult> {
  const csvString = preparePorterTransactionsCsv(rawCsv);
  const { headers, rows } = parseCsvToRows(csvString);

  const result: PorterTransactionsImportResult = {
    imported: 0,
    skipped: 0,
    duplicates: 0,
    pending: 0,
    errors: [],
    dateRange: null,
    artists: [],
  };

  if (headers.length === 0) {
    result.errors.push({ row: 1, reason: "CSV has no header row" });
    return result;
  }

  const artistSet = new Set<string>();
  const importedDates: Date[] = [];
  const commissionTiers = await settingsService.getCommissionTierInputs();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) {
      continue;
    }

    const { parsed, error } = parsePorterTransactionRow(row, headers);
    if (error) {
      result.skipped += 1;
      result.errors.push({ row: rowNum, reason: error });
      continue;
    }
    if (!parsed) {
      result.skipped += 1;
      continue;
    }

    const duplicate = await appointmentRepo.findAppointmentByArtistClientDate({
      artistName: parsed.artistName,
      clientName: parsed.clientName,
      appointmentDate: parsed.appointmentDate,
    });
    if (duplicate) {
      result.duplicates += 1;
      continue;
    }

    try {
      const artist = await findOrCreateArtist(parsed.artistName);
      const customer = await findOrCreateCustomer(parsed.clientName);
      const porterAppointmentId = `porter-tx-${randomUUID()}`;
      const schemaServiceType = toSchemaServiceType(parsed.serviceType);

      const notesParts: string[] = [];
      if (parsed.salesTax > 0) {
        notesParts.push(`Sales tax: $${parsed.salesTax.toFixed(2)}`);
      }
      if (parsed.refundedAmount > 0) {
        notesParts.push(`Refunded: $${parsed.refundedAmount.toFixed(2)}`);
      }
      if (parsed.voidedAmount > 0) {
        notesParts.push(`Voided: $${parsed.voidedAmount.toFixed(2)}`);
      }

      const appointment = await appointmentRepo.upsertAppointment(porterAppointmentId, {
        customerId: customer.id,
        artistId: artist.id,
        serviceType: schemaServiceType,
        status: parsed.status,
        appointmentDate: parsed.appointmentDate,
        completedDate:
          parsed.status === "completed" ? parsed.appointmentDate : null,
        depositCollected: parsed.status === "scheduled" && parsed.totalRevenue > 0,
        notes: notesParts.length > 0 ? notesParts.join("; ") : null,
      });

      if (parsed.totalRevenue > 0 || parsed.tip > 0) {
        const { artistPct } = getCommissionRate(parsed.totalRevenue, commissionTiers);
        const resolvedArtistPayout =
          parsed.artistPayout > 0
            ? parsed.artistPayout
            : Math.round(parsed.totalRevenue * artistPct * 100) / 100;
        const commissionPct =
          parsed.totalRevenue > 0
            ? (resolvedArtistPayout / parsed.totalRevenue).toFixed(4)
            : "0.0000";

        await paymentRepo.upsertPaymentForAppointment(appointment.id, {
          appointmentId: appointment.id,
          artistId: artist.id,
          customerId: customer.id,
          serviceType: schemaServiceType,
          depositAmount: "0.00",
          finalAmount: parsed.totalRevenue.toFixed(2),
          tipAmount: parsed.tip.toFixed(2),
          totalRevenue: parsed.totalRevenue.toFixed(2),
          commissionPercentage: commissionPct,
          artistPayout: resolvedArtistPayout.toFixed(2),
          paymentDate: parsed.appointmentDate,
        });
      }

      if (parsed.status === "completed") {
        await followupService.scheduleFollowUpsForCompletedAppointment({
          clientName: parsed.clientName,
          artistId: artist.id,
          appointmentDate: parsed.appointmentDate,
        });
      } else {
        result.pending += 1;
      }

      await recomputeCustomerStats(customer.id);
      artistSet.add(parsed.artistName.trim());
      importedDates.push(parsed.appointmentDate);
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  result.artists = [...artistSet].sort((a, b) => a.localeCompare(b));
  result.dateRange = formatDateRange(importedDates);
  return result;
}
