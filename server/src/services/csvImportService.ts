/**
 * Historical CSV import (Sprint 8H).
 */
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import {
  EXPENSE_CATEGORIES,
  getCommissionRate,
  type CommissionTierInput,
  type ExpenseCategoryKey,
} from "@fallen-sparrow/shared/constants";
import * as settingsService from "./settingsService.js";
import {
  normalizeCsvServiceType,
  toSchemaServiceType,
  type CsvServiceType,
} from "@fallen-sparrow/shared/serviceTypes";
import * as artistRepo from "../repos/artistRepo.js";
import * as customerRepo from "../repos/customerRepo.js";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import * as paymentRepo from "../repos/paymentRepo.js";
import * as manualEntryRepo from "../repos/manualEntryRepo.js";
import { recomputeCustomerStats } from "./customerContinuityService.js";
import * as followupService from "./followupService.js";

export type CsvFormat = "appointments" | "expenses" | "porter" | "unknown";

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
  duplicates?: number;
  pending?: number;
  dateRange?: { from: string; to: string } | null;
  artists?: string[];
}

export interface ParsedAppointment {
  artistName: string;
  clientName: string;
  serviceType: CsvServiceType;
  totalRevenue: number;
  artistPayout: number;
  appointmentDate: Date;
  status: "completed" | "cancelled" | "no_show";
  notes: string;
}

export interface ParsedExpense {
  vendor: string;
  amount: number;
  category: ExpenseCategoryKey;
  description: string;
  expenseDate: Date;
  needsReview: boolean;
}

const APPOINTMENT_HEADERS = [
  "date",
  "artist name",
  "client name",
  "service type",
  "total revenue",
];

const EXPENSE_HEADERS = ["date", "vendor", "amount", "category"];

const PORTER_HEADERS = ["appointment_id", "client_id", "artist_id"];

export const APPOINTMENTS_TEMPLATE =
  "Date,Artist Name,Client Name,Service Type,Total Revenue,Artist Payout,Status,Notes\n" +
  "2024-01-15,Carlos,Jane Smith,tattoo,850.00,425.00,completed,Example note\n" +
  '2024-01-16,Hector,Marcus Brown,piercing,120.00,48.00,completed,"';

export const EXPENSES_TEMPLATE =
  "Date,Vendor,Amount,Category,Description\n" +
  "2024-01-15,Amazon,89.99,Supplies,Gloves and needle cartridges\n" +
  "2024-01-16,Home Depot,240.00,Maintenance,AC filter replacement";

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

function hasHeaders(headers: string[], required: string[]): boolean {
  const set = new Set(headers.map(normalizeHeader));
  return required.every((h) => set.has(h));
}

function headerIndex(headers: string[], name: string): number {
  const target = normalizeHeader(name);
  return headers.findIndex((h) => normalizeHeader(h) === target);
}

function getCell(row: string[], headers: string[], name: string): string {
  const idx = headerIndex(headers, name);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

/** Read cell by exact CSV column header chosen in the mapping UI. */
function getMappedCell(
  row: string[],
  headers: string[],
  columnHeader: string | undefined,
): string {
  if (!columnHeader?.trim()) return "";
  const idx = headers.indexOf(columnHeader);
  if (idx < 0) return "";
  return (row[idx] ?? "").trim();
}

export interface ExpenseColumnMapping {
  date: string;
  vendor: string;
  amount: string;
  category: string;
  description?: string;
}

export interface AppointmentColumnMapping {
  date: string;
  artistName: string;
  clientName: string;
  serviceType: string;
  totalRevenue: string;
  artistPayout?: string;
  status?: string;
  notes?: string;
}

export function listCsvHeaders(csvString: string): string[] {
  const { headers } = parseCsvToRows(csvString);
  return headers;
}

export function parseCsvPreview(
  csvString: string,
  maxRows = 5,
): { headers: string[]; rows: string[][] } {
  const { headers, rows } = parseCsvToRows(csvString);
  return { headers, rows: rows.slice(0, maxRows) };
}

function parseAmount(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const mdy = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Sprint 9A: belt-and-suspenders normalization before feeding normalizeCsvServiceType. */
function normalizeServiceTypeRaw(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("laser")) return "Laser Removal";
  if (s.includes("pierc")) return "Piercing";
  if (s.includes("merch")) return "Merchandise";
  return "Tattoo";
}

function normalizeStatus(raw: string): ParsedAppointment["status"] {
  const lower = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (lower === "cancelled" || lower === "canceled") return "cancelled";
  if (lower === "no_show" || lower === "noshow") return "no_show";
  return "completed";
}

function resolveExpenseCategory(raw: string): {
  category: ExpenseCategoryKey;
  needsReview: boolean;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { category: "ADMIN", needsReview: true };
  }

  const upper = trimmed.toUpperCase();
  if (upper in EXPENSE_CATEGORIES) {
    return { category: upper as ExpenseCategoryKey, needsReview: false };
  }

  for (const [key, meta] of Object.entries(EXPENSE_CATEGORIES)) {
    if (meta.name.toLowerCase() === trimmed.toLowerCase()) {
      return { category: key as ExpenseCategoryKey, needsReview: false };
    }
  }

  return { category: "ADMIN", needsReview: true };
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

export function detectCsvFormat(headers: string[]): CsvFormat {
  if (hasHeaders(headers, APPOINTMENT_HEADERS)) {
    return "appointments";
  }
  if (hasHeaders(headers, EXPENSE_HEADERS)) {
    return "expenses";
  }
  if (hasHeaders(headers, PORTER_HEADERS)) {
    return "porter";
  }
  return "unknown";
}

function parseAppointmentRow(
  row: string[],
  headers: string[],
  commissionTiers?: CommissionTierInput[],
): ParsedAppointment | null {
  const dateRaw = getCell(row, headers, "Date");
  const appointmentDate = parseDate(dateRaw);
  const totalRevenue = parseAmount(getCell(row, headers, "Total Revenue"));

  if (!appointmentDate || totalRevenue === null) {
    return null;
  }

  const payoutRaw = getCell(row, headers, "Artist Payout");
  const parsedPayout = payoutRaw ? parseAmount(payoutRaw) : null;
  const { artistPct } = getCommissionRate(totalRevenue, commissionTiers);
  const artistPayout =
    parsedPayout !== null ? parsedPayout : Math.round(totalRevenue * artistPct * 100) / 100;

  return {
    artistName: getCell(row, headers, "Artist Name"),
    clientName: getCell(row, headers, "Client Name"),
    serviceType: normalizeCsvServiceType(normalizeServiceTypeRaw(getCell(row, headers, "Service Type"))),
    totalRevenue,
    artistPayout,
    appointmentDate,
    status: normalizeStatus(getCell(row, headers, "Status")),
    notes: getCell(row, headers, "Notes"),
  };
}

function parseAppointmentRowMapped(
  row: string[],
  headers: string[],
  mapping: AppointmentColumnMapping,
  commissionTiers?: CommissionTierInput[],
): ParsedAppointment | null {
  const appointmentDate = parseDate(getMappedCell(row, headers, mapping.date));
  const totalRevenue = parseAmount(
    getMappedCell(row, headers, mapping.totalRevenue),
  );

  if (!appointmentDate || totalRevenue === null) {
    return null;
  }

  const payoutCol = mapping.artistPayout?.trim();
  const payoutRaw = payoutCol
    ? getMappedCell(row, headers, payoutCol)
    : "";
  const parsedPayout = payoutRaw ? parseAmount(payoutRaw) : null;
  const { artistPct } = getCommissionRate(totalRevenue, commissionTiers);
  const artistPayout =
    parsedPayout !== null ? parsedPayout : Math.round(totalRevenue * artistPct * 100) / 100;

  const statusCol = mapping.status?.trim();
  const statusRaw = statusCol ? getMappedCell(row, headers, statusCol) : "";

  const notesCol = mapping.notes?.trim();
  const notes = notesCol ? getMappedCell(row, headers, notesCol) : "";

  return {
    artistName: getMappedCell(row, headers, mapping.artistName),
    clientName: getMappedCell(row, headers, mapping.clientName),
    serviceType: normalizeCsvServiceType(
      normalizeServiceTypeRaw(getMappedCell(row, headers, mapping.serviceType)),
    ),
    totalRevenue,
    artistPayout,
    appointmentDate,
    status: normalizeStatus(statusRaw),
    notes,
  };
}

export function parseAppointmentsCsv(rows: string[][]): ParsedAppointment[] {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow ?? [];
  const parsed: ParsedAppointment[] = [];
  for (const row of dataRows) {
    const item = parseAppointmentRow(row, headers);
    if (item) parsed.push(item);
  }
  return parsed;
}

function parseExpenseRow(row: string[], headers: string[]): ParsedExpense | null {
  const dateRaw = getCell(row, headers, "Date");
  const expenseDate = parseDate(dateRaw);
  const amount = parseAmount(getCell(row, headers, "Amount"));
  const vendor = getCell(row, headers, "Vendor");

  if (!expenseDate || amount === null || !vendor) {
    return null;
  }

  const { category, needsReview } = resolveExpenseCategory(
    getCell(row, headers, "Category"),
  );

  return {
    vendor,
    amount,
    category,
    description: getCell(row, headers, "Description"),
    expenseDate,
    needsReview,
  };
}

function parseExpenseRowMapped(
  row: string[],
  headers: string[],
  mapping: ExpenseColumnMapping,
): ParsedExpense | null {
  const expenseDate = parseDate(getMappedCell(row, headers, mapping.date));
  const amount = parseAmount(getMappedCell(row, headers, mapping.amount));
  const vendor = getMappedCell(row, headers, mapping.vendor);

  if (!expenseDate || amount === null || !vendor) {
    return null;
  }

  const { category, needsReview } = resolveExpenseCategory(
    getMappedCell(row, headers, mapping.category),
  );

  const description = mapping.description
    ? getMappedCell(row, headers, mapping.description)
    : "";

  return {
    vendor,
    amount,
    category,
    description,
    expenseDate,
    needsReview,
  };
}

export function parseExpensesCsv(rows: string[][]): ParsedExpense[] {
  if (rows.length === 0) return [];
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow ?? [];
  const parsed: ParsedExpense[] = [];
  for (const row of dataRows) {
    const item = parseExpenseRow(row, headers);
    if (item) parsed.push(item);
  }
  return parsed;
}

async function findOrCreateArtist(name: string) {
  const trimmed = name.trim() || "Unknown Artist";
  const existing = await artistRepo.findArtistByName(trimmed);
  if (existing) return existing;

  // TODO: confirm artist details (commission, active status) after historical import
  return artistRepo.createArtist({
    name: trimmed,
    commissionPercentage: "0.6000",
    isActive: true,
  });
}

async function findOrCreateCustomer(name: string) {
  const trimmed = name.trim() || "Unknown Client";
  const existing = await customerRepo.findCustomerByName(trimmed);
  if (existing) return existing;

  return customerRepo.createCustomer({ name: trimmed });
}

export async function importAppointmentsCsv(csvString: string): Promise<ImportResult> {
  const { headers, rows } = parseCsvToRows(csvString);
  const format = detectCsvFormat(headers);
  if (format !== "appointments") {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [{ row: 1, reason: "CSV is not in appointments format" }],
    };
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const affectedCustomers = new Set<string>();
  const commissionTiers = await settingsService.getCommissionTierInputs();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) continue;

    const parsed = parseAppointmentRow(row, headers, commissionTiers);
    if (!parsed) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: "Missing or invalid Date or Total Revenue",
      });
      continue;
    }

    try {
      const artist = await findOrCreateArtist(parsed.artistName);
      const customer = await findOrCreateCustomer(parsed.clientName);
      const porterAppointmentId = `historical-${randomUUID()}`;
      const schemaServiceType = toSchemaServiceType(parsed.serviceType);

      const appointment = await appointmentRepo.upsertAppointment(porterAppointmentId, {
        customerId: customer.id,
        artistId: artist.id,
        serviceType: schemaServiceType,
        status: parsed.status,
        appointmentDate: parsed.appointmentDate,
        completedDate:
          parsed.status === "completed" ? parsed.appointmentDate : null,
        depositCollected: false,
        notes: parsed.notes || null,
      });

      if (parsed.status === "completed" && parsed.totalRevenue > 0) {
        const commissionPct =
          parsed.totalRevenue > 0
            ? (parsed.artistPayout / parsed.totalRevenue).toFixed(4)
            : "0.5000";

        await paymentRepo.upsertPaymentForAppointment(appointment.id, {
          appointmentId: appointment.id,
          artistId: artist.id,
          customerId: customer.id,
          serviceType: schemaServiceType,
          depositAmount: "0.00",
          finalAmount: parsed.totalRevenue.toFixed(2),
          tipAmount: "0.00",
          totalRevenue: parsed.totalRevenue.toFixed(2),
          commissionPercentage: commissionPct,
          artistPayout: parsed.artistPayout.toFixed(2),
          paymentDate: parsed.appointmentDate,
        });
      }

      if (parsed.status === "completed") {
        await followupService.scheduleFollowUpsForCompletedAppointment({
          clientName: parsed.clientName,
          artistId: artist.id,
          appointmentDate: parsed.appointmentDate,
        });
      }

      affectedCustomers.add(customer.id);
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  for (const customerId of affectedCustomers) {
    await recomputeCustomerStats(customerId);
  }

  return result;
}

export async function importExpensesCsv(
  csvString: string,
  loggedByUserId?: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvToRows(csvString);
  const format = detectCsvFormat(headers);
  if (format !== "expenses") {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [{ row: 1, reason: "CSV is not in expenses format" }],
    };
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) continue;

    const parsed = parseExpenseRow(row, headers);
    if (!parsed) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: "Missing or invalid Date, Amount, or Vendor",
      });
      continue;
    }

    try {
      await manualEntryRepo.insertManualExpense({
        vendor: parsed.vendor,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description || parsed.vendor,
        expenseDate: parsed.expenseDate,
        loggedByUserId,
        needsReview: parsed.needsReview,
      });
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return result;
}

export async function importExpensesCsvWithMapping(
  csvString: string,
  mapping: ExpenseColumnMapping,
  loggedByUserId?: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvToRows(csvString);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) continue;

    const parsed = parseExpenseRowMapped(row, headers, mapping);
    if (!parsed) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: "Missing or invalid Date, Amount, or Vendor",
      });
      continue;
    }

    try {
      await manualEntryRepo.insertManualExpense({
        vendor: parsed.vendor,
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description || parsed.vendor,
        expenseDate: parsed.expenseDate,
        loggedByUserId,
        needsReview: parsed.needsReview,
      });
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  return result;
}

export async function importAppointmentsCsvWithMapping(
  csvString: string,
  mapping: AppointmentColumnMapping,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvToRows(csvString);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };
  const affectedCustomers = new Set<string>();
  const commissionTiers = await settingsService.getCommissionTierInputs();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) continue;

    const parsed = parseAppointmentRowMapped(row, headers, mapping, commissionTiers);
    if (!parsed) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: "Missing or invalid Date or Total Revenue",
      });
      continue;
    }

    try {
      const artist = await findOrCreateArtist(parsed.artistName);
      const customer = await findOrCreateCustomer(parsed.clientName);
      const porterAppointmentId = `historical-${randomUUID()}`;
      const schemaServiceType = toSchemaServiceType(parsed.serviceType);

      const appointment = await appointmentRepo.upsertAppointment(porterAppointmentId, {
        customerId: customer.id,
        artistId: artist.id,
        serviceType: schemaServiceType,
        status: parsed.status,
        appointmentDate: parsed.appointmentDate,
        completedDate:
          parsed.status === "completed" ? parsed.appointmentDate : null,
        depositCollected: false,
        notes: parsed.notes || null,
      });

      if (parsed.status === "completed" && parsed.totalRevenue > 0) {
        const commissionPct =
          parsed.totalRevenue > 0
            ? (parsed.artistPayout / parsed.totalRevenue).toFixed(4)
            : "0.5000";

        await paymentRepo.upsertPaymentForAppointment(appointment.id, {
          appointmentId: appointment.id,
          artistId: artist.id,
          customerId: customer.id,
          serviceType: schemaServiceType,
          depositAmount: "0.00",
          finalAmount: parsed.totalRevenue.toFixed(2),
          tipAmount: "0.00",
          totalRevenue: parsed.totalRevenue.toFixed(2),
          commissionPercentage: commissionPct,
          artistPayout: parsed.artistPayout.toFixed(2),
          paymentDate: parsed.appointmentDate,
        });
      }

      if (parsed.status === "completed") {
        await followupService.scheduleFollowUpsForCompletedAppointment({
          clientName: parsed.clientName,
          artistId: artist.id,
          appointmentDate: parsed.appointmentDate,
        });
      }

      affectedCustomers.add(customer.id);
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Import failed",
      });
    }
  }

  for (const customerId of affectedCustomers) {
    await recomputeCustomerStats(customerId);
  }

  return result;
}

/**
 * Reclassify service types on existing historical CSV imports by matching
 * artist, client, date, and revenue against a source CSV.
 */
export async function reclassifyServiceTypesFromCsv(
  csvString: string,
): Promise<ImportResult> {
  const { headers, rows } = parseCsvToRows(csvString);
  const format = detectCsvFormat(headers);
  if (format !== "appointments") {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [{ row: 1, reason: "CSV is not in appointments format" }],
    };
  }

  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const row = rows[i];
    if (!row) continue;

    const parsed = parseAppointmentRow(row, headers);
    if (!parsed) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: "Missing or invalid Date or Total Revenue",
      });
      continue;
    }

    const schemaServiceType = toSchemaServiceType(parsed.serviceType);

    try {
      const match = await appointmentRepo.findHistoricalImportMatch({
        artistName: parsed.artistName,
        clientName: parsed.clientName,
        appointmentDate: parsed.appointmentDate,
        totalRevenue: parsed.totalRevenue,
      });

      if (!match) {
        result.skipped += 1;
        result.errors.push({
          row: rowNum,
          reason: "No matching historical appointment found",
        });
        continue;
      }

      if (match.serviceType === schemaServiceType) {
        result.skipped += 1;
        continue;
      }

      await appointmentRepo.updateAppointmentServiceType(
        match.id,
        schemaServiceType,
      );
      await paymentRepo.updatePaymentServiceTypeForAppointment(
        match.id,
        schemaServiceType,
      );
      result.imported += 1;
    } catch (err) {
      result.skipped += 1;
      result.errors.push({
        row: rowNum,
        reason: err instanceof Error ? err.message : "Reclassification failed",
      });
    }
  }

  return result;
}
