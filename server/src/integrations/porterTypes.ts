/**
 * MASTER_SPEC_v3 §8.3 — normalized Porter appointment shape.
 */

export type PorterServiceType = "tattoo" | "piercing" | "laser" | "other";
export type PorterApptStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "no_show";

export interface NormalizedPorterAppointment {
  porterAppointmentId: string;
  porterClientId: string;
  clientName: string;
  porterArtistId: string;
  artistName: string;
  serviceType: PorterServiceType;
  depositAmount: number;
  finalAmount: number;
  tipAmount: number;
  totalRevenue: number;
  appointmentDate: string;
  completedDate: string | null;
  status: PorterApptStatus;
  paymentMethod?: string;
  notes?: string;
  walkInGreetedBy?: string | null;
}

/** Raw CSV row — column names unconfirmed until Q1d (MASTER_SPEC_v3 §8.4). */
export type PorterCsvRow = Record<string, string>;
