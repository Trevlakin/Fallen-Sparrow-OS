/**
 * MASTER_SPEC_v3 §8.4 — single place for CSV column → normalized mapping.
 * Porter field names are UNCONFIRMED (open item Q1d).
 */
import { z } from "zod";
import { normalizeSchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import type {
  NormalizedPorterAppointment,
  PorterCsvRow,
  PorterServiceType,
} from "./porterTypes.js";

// TODO(Q1d): Replace placeholder column keys with confirmed Porter/Zapier CSV headers from Legion.
const PLACEHOLDER_COLUMNS = {
  appointmentId: "appointment_id",
  clientId: "client_id",
  clientName: "client_name",
  artistId: "artist_id",
  artistName: "artist_name",
  serviceType: "service_type",
  depositAmount: "deposit_amount",
  finalAmount: "final_amount",
  tipAmount: "tip_amount",
  totalRevenue: "total_revenue",
  appointmentDate: "appointment_date",
  completedDate: "completed_date",
  status: "status",
  paymentMethod: "payment_method",
  notes: "notes",
  walkInGreetedBy: "walk_in_greeted_by",
} as const;

const statusSchema = z.enum([
  "scheduled",
  "completed",
  "cancelled",
  "no_show",
]);

function pick(row: PorterCsvRow, key: string): string {
  return (row[key] ?? "").trim();
}

function parseNumber(value: string): number {
  const n = Number.parseFloat(value.replace(/[$,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Sprint 9A: normalize raw service type string before schema mapping. */
function normalizeServiceTypeRaw(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s.includes("laser")) return "Laser Removal";
  if (s.includes("pierc")) return "Piercing";
  if (s.includes("merch")) return "Merchandise";
  return "Tattoo";
}

function normalizeServiceType(raw: string): PorterServiceType {
  return normalizeSchemaServiceType(normalizeServiceTypeRaw(raw));
}

function normalizeStatus(raw: string): NormalizedPorterAppointment["status"] {
  const lower = raw.toLowerCase().replace(/\s+/g, "_");
  const parsed = statusSchema.safeParse(lower);
  if (parsed.success) return parsed.data;
  return "scheduled";
}

export function mapPorterRow(row: PorterCsvRow): NormalizedPorterAppointment | null {
  const c = PLACEHOLDER_COLUMNS;
  const porterAppointmentId = pick(row, c.appointmentId);
  const porterClientId = pick(row, c.clientId);
  const porterArtistId = pick(row, c.artistId);

  if (!porterAppointmentId || !porterClientId || !porterArtistId) {
    return null;
  }

  return {
    porterAppointmentId,
    porterClientId,
    clientName: pick(row, c.clientName) || "Unknown",
    porterArtistId,
    artistName: pick(row, c.artistName) || "Unknown",
    serviceType: normalizeServiceType(pick(row, c.serviceType)),
    depositAmount: parseNumber(pick(row, c.depositAmount)),
    finalAmount: parseNumber(pick(row, c.finalAmount)),
    tipAmount: parseNumber(pick(row, c.tipAmount)),
    totalRevenue: parseNumber(pick(row, c.totalRevenue)),
    appointmentDate: pick(row, c.appointmentDate) || new Date().toISOString(),
    completedDate: pick(row, c.completedDate) || null,
    status: normalizeStatus(pick(row, c.status)),
    paymentMethod: pick(row, c.paymentMethod) || undefined,
    notes: pick(row, c.notes) || undefined,
    walkInGreetedBy: pick(row, c.walkInGreetedBy) || null,
  };
}
