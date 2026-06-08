/**
 * MASTER_SPEC_v3 §6.1: artist performance summaries.
 */
import type { Artist } from "@fallen-sparrow/shared/schema";
import {
  calculateShopMargin,
  calculateShopMarginPercent,
  roundMoney,
  roundPercent,
} from "../lib/profit.js";
import * as artistRepo from "../repos/artistRepo.js";
import { AppError } from "../utils/errors.js";

export interface ArtistRecentAppointmentSummary {
  appointmentId: string;
  appointmentDate: string;
  completedDate: string | null;
  status: string;
  serviceType: string;
  customerId: string | null;
  customerName: string | null;
  totalRevenue: number;
}

export interface ArtistPerformanceSummary {
  artistId: string;
  artistName: string;
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  commissionEarned: number;
  shopMargin: number;
  shopMarginPercent: number;
  appointmentCount: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  avgBookingValue: number;
  revenuePerDay: number;
  repeatCustomerCount: number;
  repeatCustomerRate: number;
  customersServed: number;
  bookingUtilization: number;
  portfolioFreshnessDays: number | null;
  recentAppointments: ArtistRecentAppointmentSummary[];
}

function daysInPeriod(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setUTCHours(23, 59, 59, 999);

  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

function portfolioFreshnessDays(artist: Artist, asOf: Date): number | null {
  if (!artist.lastPortfolioUpdate) {
    return null;
  }
  const ms = asOf.getTime() - artist.lastPortfolioUpdate.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

async function buildPerformanceSummary(
  artist: Artist,
  from: Date,
  to: Date,
  recentLimit: number,
): Promise<ArtistPerformanceSummary> {
  const [stats, repeatCustomerCount, bookingDays, recentRows] = await Promise.all([
    artistRepo.getArtistAppointmentStats(artist.id, from, to),
    artistRepo.getRepeatCustomerCount(artist.id, from, to),
    artistRepo.countDistinctBookingDays(artist.id, from, to),
    artistRepo.getArtistRecentAppointments(artist.id, recentLimit),
  ]);

  const totalRevenue = roundMoney(stats.totalRevenue);
  const commissionEarned = roundMoney(stats.totalCommission);
  const shopMargin = roundMoney(calculateShopMargin(totalRevenue, commissionEarned));
  const periodDays = daysInPeriod(from, to);
  const businessDays = countBusinessDays(from, to);
  const avgBookingValue =
    stats.completed > 0 ? roundMoney(totalRevenue / stats.completed) : 0;
  const revenuePerDay = roundMoney(totalRevenue / periodDays);
  const repeatCustomerRate =
    stats.customersServed > 0
      ? roundPercent(repeatCustomerCount / stats.customersServed)
      : 0;
  const bookingUtilization = roundPercent(bookingDays / businessDays);

  return {
    artistId: artist.id,
    artistName: artist.name,
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    totalRevenue,
    commissionEarned,
    shopMargin,
    shopMarginPercent: calculateShopMarginPercent(totalRevenue, commissionEarned),
    appointmentCount: stats.totalAppointments,
    completedCount: stats.completed,
    cancelledCount: stats.cancelled,
    noShowCount: stats.noShow,
    avgBookingValue,
    revenuePerDay,
    repeatCustomerCount,
    repeatCustomerRate,
    customersServed: stats.customersServed,
    bookingUtilization,
    portfolioFreshnessDays: portfolioFreshnessDays(artist, to),
    recentAppointments: recentRows.map((row) => ({
      appointmentId: row.appointmentId,
      appointmentDate: row.appointmentDate.toISOString(),
      completedDate: row.completedDate?.toISOString() ?? null,
      status: row.status,
      serviceType: row.serviceType,
      customerId: row.customerId,
      customerName: row.customerName,
      totalRevenue: row.totalRevenue ? roundMoney(Number.parseFloat(row.totalRevenue)) : 0,
    })),
  };
}

export async function getArtistPerformanceSummary(
  artistId: string,
  from: Date,
  to: Date,
  recentLimit = 5,
): Promise<ArtistPerformanceSummary> {
  const artist = await artistRepo.findArtistById(artistId);
  if (!artist) {
    throw new AppError("Artist not found", 404);
  }
  return buildPerformanceSummary(artist, from, to, recentLimit);
}

export async function getAllArtistsPerformanceSummary(
  from: Date,
  to: Date,
  recentLimit = 5,
): Promise<ArtistPerformanceSummary[]> {
  const artists = await artistRepo.listActiveArtists();
  return Promise.all(
    artists.map((artist) => buildPerformanceSummary(artist, from, to, recentLimit)),
  );
}
