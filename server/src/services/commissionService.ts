/**
 * Commission summaries from Porter payment data + manual overrides (MASTER_SPEC_v3 §9, Sprint 5A).
 */
import type { Artist } from "@fallen-sparrow/shared/schema";
import {
  calculateShopMargin,
  calculateShopMarginPercent,
  roundMoney,
} from "../lib/profit.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as commissionRepo from "../repos/commissionRepo.js";
import * as settingsService from "./settingsService.js";

export interface ArtistCommissionSummary {
  artistId: string;
  artistName: string;
  totalRevenue: number;
  totalArtistPayout: number;
  totalShopRevenue: number;
  shopMarginPercent: number;
  appointmentCount: number;
  manualOverrides: commissionRepo.ManualCommissionOverride[];
}

export interface AllArtistsCommissionSummary {
  periodStart: string;
  periodEnd: string;
  artists: ArtistCommissionSummary[];
  totals: {
    totalRevenue: number;
    totalArtistPayout: number;
    totalShopRevenue: number;
  };
}

function buildArtistNameMap(artists: Artist[]): Map<string, string> {
  return new Map(artists.map((artist) => [artist.id, artist.name]));
}

export async function getArtistCommissionSummary(
  shopId: string,
  artistId: string,
  from: Date,
  to: Date,
): Promise<ArtistCommissionSummary> {
  const [payouts, overrides, artists] = await Promise.all([
    commissionRepo.getArtistPayoutsByPeriod(shopId, artistId, from, to),
    commissionRepo.listManualOverrides(shopId, artistId),
    artistRepo.listActiveArtists(),
  ]);

  const artistNames = buildArtistNameMap(artists);
  const totalRevenue = roundMoney(payouts.totalRevenue);
  const totalArtistPayout = roundMoney(payouts.totalArtistPayout);
  const totalShopRevenue = roundMoney(
    calculateShopMargin(totalRevenue, totalArtistPayout),
  );

  return {
    artistId,
    artistName: artistNames.get(artistId) ?? "Unknown Artist",
    totalRevenue,
    totalArtistPayout,
    totalShopRevenue,
    shopMarginPercent: calculateShopMarginPercent(totalRevenue, totalArtistPayout),
    appointmentCount: payouts.appointmentCount,
    manualOverrides: overrides.map((row) => ({
      ...row,
      amount: roundMoney(row.amount),
    })),
  };
}

export async function getAllArtistsCommissionSummary(
  shopId: string,
  from: Date,
  to: Date,
): Promise<AllArtistsCommissionSummary> {
  const [payoutRows, artists] = await Promise.all([
    commissionRepo.getAllArtistPayoutsByPeriod(shopId, from, to),
    artistRepo.listActiveArtists(),
  ]);

  const artistNames = buildArtistNameMap(artists);
  let totalRevenue = 0;
  let totalArtistPayout = 0;

  const artistSummaries: ArtistCommissionSummary[] = await Promise.all(
    payoutRows.map(async (row) => {
      const revenue = roundMoney(row.totalRevenue);
      const payout = roundMoney(row.totalArtistPayout);
      totalRevenue += revenue;
      totalArtistPayout += payout;

      const overrides = await commissionRepo.listManualOverrides(shopId, row.artistId);

      return {
        artistId: row.artistId,
        artistName: artistNames.get(row.artistId) ?? "Unknown Artist",
        totalRevenue: revenue,
        totalArtistPayout: payout,
        totalShopRevenue: roundMoney(calculateShopMargin(revenue, payout)),
        shopMarginPercent: calculateShopMarginPercent(revenue, payout),
        appointmentCount: row.appointmentCount,
        manualOverrides: overrides.map((o) => ({
          ...o,
          amount: roundMoney(o.amount),
        })),
      };
    }),
  );

  return {
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    artists: artistSummaries,
    totals: {
      totalRevenue: roundMoney(totalRevenue),
      totalArtistPayout: roundMoney(totalArtistPayout),
      totalShopRevenue: roundMoney(
        calculateShopMargin(totalRevenue, totalArtistPayout),
      ),
    },
  };
}

export async function upsertManualCommission(
  shopId: string,
  artistId: string,
  monthStr: string,
  amount: number,
): Promise<void> {
  const [year, month] = monthStr.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid month format: ${monthStr}. Expected YYYY-MM`);
  }
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  await commissionRepo.upsertManualOverride(shopId, artistId, monthDate, amount);
}

export async function listManualCommissions(
  shopId: string,
  artistId: string,
): Promise<commissionRepo.ManualCommissionOverride[]> {
  const rows = await commissionRepo.listManualOverrides(shopId, artistId);
  return rows.map((row) => ({
    ...row,
    amount: roundMoney(row.amount),
  }));
}

/** Rates and bonuses for commission calculations (settings only, never hardcoded). */
export async function getCommissionConfig(): Promise<{
  rates: settingsService.CommissionRatesSetting;
  bonuses: settingsService.BonusSettings;
}> {
  const [rates, bonuses] = await Promise.all([
    settingsService.getCommissionRates(),
    settingsService.getBonusAmounts(),
  ]);
  return { rates, bonuses };
}
