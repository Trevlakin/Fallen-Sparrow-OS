import { randomUUID } from "node:crypto";
import {
  SCHEMA_SERVICE_TYPES,
  type SchemaServiceType,
} from "@fallen-sparrow/shared/serviceTypes";
import * as appointmentRepo from "../repos/appointmentRepo.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as customerRepo from "../repos/customerRepo.js";
import * as paymentRepo from "../repos/paymentRepo.js";
import { AppError } from "../utils/errors.js";
import { recomputeCustomerStats } from "./customerContinuityService.js";
import * as settingsService from "./settingsService.js";
import * as followupService from "./followupService.js";

export interface CreateManualSaleInput {
  appointmentDate: Date;
  artistId?: string;
  artistName?: string;
  clientName: string;
  serviceType: SchemaServiceType;
  totalRevenue: number;
  artistPayout?: number;
  notes?: string;
}

export interface CreateManualSaleResult {
  appointmentId: string;
  customerId: string;
  artistId: string;
}

async function resolveArtist(
  artistId: string | undefined,
  artistName: string | undefined,
): Promise<{ id: string }> {
  if (artistId) {
    const artist = await artistRepo.findArtistById(artistId);
    if (!artist) {
      throw new AppError("Artist not found", 404);
    }
    return { id: artist.id };
  }

  const trimmed = artistName?.trim();
  if (!trimmed) {
    throw new AppError("Select an artist or enter an artist name", 400);
  }

  const existing = await artistRepo.findArtistByName(trimmed);
  if (existing) {
    return { id: existing.id };
  }

  const created = await artistRepo.createArtist({
    name: trimmed,
    commissionPercentage: "0.5000",
    isActive: false,
  });
  return { id: created.id };
}

async function resolveCustomer(clientName: string): Promise<{ id: string }> {
  const trimmed = clientName.trim();
  if (!trimmed) {
    throw new AppError("Client name is required", 400);
  }

  const existing = await customerRepo.findCustomerByName(trimmed);
  if (existing) {
    return { id: existing.id };
  }

  const created = await customerRepo.createCustomer({ name: trimmed });
  return { id: created.id };
}

function assertServiceType(value: string): SchemaServiceType {
  if ((SCHEMA_SERVICE_TYPES as readonly string[]).includes(value)) {
    return value as SchemaServiceType;
  }
  throw new AppError("Invalid service type", 400);
}

export async function createManualSale(
  input: CreateManualSaleInput,
): Promise<CreateManualSaleResult> {
  const serviceType = assertServiceType(input.serviceType);
  const totalRevenue = input.totalRevenue;
  if (!Number.isFinite(totalRevenue) || totalRevenue <= 0) {
    throw new AppError("Total revenue must be greater than zero", 400);
  }

  const artist = await resolveArtist(input.artistId, input.artistName);
  const customer = await resolveCustomer(input.clientName);

  let artistPayout = input.artistPayout;
  if (artistPayout !== undefined) {
    if (!Number.isFinite(artistPayout) || artistPayout < 0) {
      throw new AppError("Artist payout must be zero or greater", 400);
    }
    if (artistPayout > totalRevenue) {
      throw new AppError("Artist payout cannot exceed total revenue", 400);
    }
  } else {
    const { artistPct } = await settingsService.getSessionCommissionRate(totalRevenue);
    artistPayout = totalRevenue * artistPct;
  }

  const commissionPct =
    totalRevenue > 0 ? (artistPayout / totalRevenue).toFixed(4) : "0.5000";

  const porterAppointmentId = `manual-${randomUUID()}`;
  const appointment = await appointmentRepo.upsertAppointment(porterAppointmentId, {
    customerId: customer.id,
    artistId: artist.id,
    serviceType,
    status: "completed",
    appointmentDate: input.appointmentDate,
    completedDate: input.appointmentDate,
    depositCollected: false,
    notes: input.notes?.trim() || null,
  });

  await paymentRepo.upsertPaymentForAppointment(appointment.id, {
    appointmentId: appointment.id,
    artistId: artist.id,
    customerId: customer.id,
    serviceType,
    depositAmount: "0.00",
    finalAmount: totalRevenue.toFixed(2),
    tipAmount: "0.00",
    totalRevenue: totalRevenue.toFixed(2),
    commissionPercentage: commissionPct,
    artistPayout: artistPayout.toFixed(2),
    paymentDate: input.appointmentDate,
  });

  await recomputeCustomerStats(customer.id);

  await followupService.scheduleFollowUpsForCompletedAppointment({
    clientName: input.clientName,
    artistId: artist.id,
    appointmentDate: input.appointmentDate,
  });

  return {
    appointmentId: appointment.id,
    customerId: customer.id,
    artistId: artist.id,
  };
}

export async function listArtistsForManualSale(): Promise<artistRepo.ArtistPickerRow[]> {
  return artistRepo.listArtistsForPicker();
}
