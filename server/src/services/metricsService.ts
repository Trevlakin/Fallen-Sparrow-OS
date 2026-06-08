/**
 * Daily / weekly / monthly metrics by artist + service type (MASTER_SPEC_v3 Sprint 3).
 */
import type { Artist } from "@fallen-sparrow/shared/schema";
import {
  calculateMarginPercent,
  calculateServiceProfit,
  calculateShopMargin,
  calculateShopMarginPercent,
  roundMoney,
  type ServiceType,
} from "../lib/profit.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as revenueRepo from "../repos/revenueRepo.js";
import * as expenseRepo from "../repos/expenseRepo.js";

export interface ServiceMetrics {
  revenue: number;
  count: number;
  avgValue: number;
  tips: number;
  profit: number;
  margin: number;
}

export interface ArtistTotalMetrics {
  revenue: number;
  count: number;
  tips: number;
  artistPayout: number;
  shopMargin: number;
  shopMarginPercent: number;
}

export interface ArtistMetrics {
  artistName: string;
  services: Partial<Record<ServiceType, ServiceMetrics>>;
  total: ArtistTotalMetrics;
}

export interface DailySummary {
  date: string;
  byArtist: Record<string, ArtistMetrics>;
  byService: Partial<Record<ServiceType, ServiceMetrics>>;
  totalRevenue: number;
  totalTips: number;
  appointmentCount: number;
  flags: Array<{ type: string; count: number }>;
}

export interface WeeklySummary {
  start: string;
  end: string;
  byArtist: Record<string, ArtistMetrics>;
  byService: Partial<Record<ServiceType, ServiceMetrics>>;
  totalRevenue: number;
  totalTips: number;
  appointmentCount: number;
  flags: Array<{ type: string; count: number }>;
}

export interface MonthlyServiceMetrics extends ServiceMetrics {
  cogs: number;
  artistPayouts: number;
  shopMargin: number;
  volumePercent: number;
}

export interface MonthlyArtistMetrics {
  artistName: string;
  revenue: number;
  payout: number;
  margin: number;
  appointmentCount: number;
}

export interface MonthlySummary {
  month: string;
  totalRevenue: number;
  totalCosts: {
    cogs: number;
    payroll: number;
  };
  netProfit: number;
  marginPercent: number;
  byArtist: Record<string, MonthlyArtistMetrics>;
  byService: Partial<Record<ServiceType, MonthlyServiceMetrics>>;
  appointmentCount: number;
}

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function monthRange(year: number, month: number): { start: Date; end: Date; label: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const label = `${year}-${String(month).padStart(2, "0")}`;
  return { start, end, label };
}

function buildArtistNameMap(artists: Artist[]): Map<string, string> {
  return new Map(artists.map((artist) => [artist.id, artist.name]));
}

function buildServiceMetrics(
  revenue: number,
  count: number,
  tips: number,
  cost: number,
  serviceType: ServiceType,
): ServiceMetrics {
  const profit = calculateServiceProfit(revenue, cost > 0 ? cost : null, serviceType);
  const avgValue = count > 0 ? roundMoney(revenue / count) : 0;
  return {
    revenue: roundMoney(revenue),
    count,
    avgValue,
    tips: roundMoney(tips),
    profit: roundMoney(profit),
    margin: calculateMarginPercent(revenue, profit),
  };
}

function buildFlags(statusCounts: revenueRepo.AppointmentStatusCounts): Array<{
  type: string;
  count: number;
}> {
  const flags: Array<{ type: string; count: number }> = [];
  if (statusCounts.noShow > 0) {
    flags.push({ type: "no_show", count: statusCounts.noShow });
  }
  if (statusCounts.cancelled > 0) {
    flags.push({ type: "cancelled", count: statusCounts.cancelled });
  }
  return flags;
}

async function buildPeriodMetrics(
  startDate: Date,
  endDate: Date,
): Promise<{
  byArtist: Record<string, ArtistMetrics>;
  byService: Partial<Record<ServiceType, ServiceMetrics>>;
  totalRevenue: number;
  totalTips: number;
  appointmentCount: number;
  flags: Array<{ type: string; count: number }>;
}> {
  const [aggregates, statusCounts, artists] = await Promise.all([
    revenueRepo.getPaymentAggregatesByArtistAndService(startDate, endDate),
    revenueRepo.getAppointmentStatusCounts(startDate, endDate),
    artistRepo.listActiveArtists(),
  ]);

  const artistNames = buildArtistNameMap(artists);
  const byArtist: Record<string, ArtistMetrics> = {};
  const serviceAccumulator = new Map<
    ServiceType,
    { revenue: number; count: number; tips: number; cost: number }
  >();

  let totalRevenue = 0;
  let totalTips = 0;
  let appointmentCount = 0;

  for (const row of aggregates) {
    totalRevenue += row.revenue;
    totalTips += row.tips;
    appointmentCount += row.count;

    const serviceMetrics = buildServiceMetrics(
      row.revenue,
      row.count,
      row.tips,
      row.cost,
      row.serviceType,
    );

    const serviceAcc = serviceAccumulator.get(row.serviceType) ?? {
      revenue: 0,
      count: 0,
      tips: 0,
      cost: 0,
    };
    serviceAcc.revenue += row.revenue;
    serviceAcc.count += row.count;
    serviceAcc.tips += row.tips;
    serviceAcc.cost += row.cost;
    serviceAccumulator.set(row.serviceType, serviceAcc);

    const artistEntry =
      byArtist[row.artistId] ??
      ({
        artistName: artistNames.get(row.artistId) ?? "Unknown Artist",
        services: {},
        total: {
          revenue: 0,
          count: 0,
          tips: 0,
          artistPayout: 0,
          shopMargin: 0,
          shopMarginPercent: 0,
        },
      } satisfies ArtistMetrics);

    artistEntry.services[row.serviceType] = serviceMetrics;
    artistEntry.total.revenue = roundMoney(artistEntry.total.revenue + row.revenue);
    artistEntry.total.count += row.count;
    artistEntry.total.tips = roundMoney(artistEntry.total.tips + row.tips);
    artistEntry.total.artistPayout = roundMoney(
      artistEntry.total.artistPayout + row.artistPayout,
    );
    artistEntry.total.shopMargin = roundMoney(
      calculateShopMargin(artistEntry.total.revenue, artistEntry.total.artistPayout),
    );
    artistEntry.total.shopMarginPercent = calculateShopMarginPercent(
      artistEntry.total.revenue,
      artistEntry.total.artistPayout,
    );

    byArtist[row.artistId] = artistEntry;
  }

  const byService: Partial<Record<ServiceType, ServiceMetrics>> = {};
  for (const [serviceType, acc] of serviceAccumulator) {
    byService[serviceType] = buildServiceMetrics(
      acc.revenue,
      acc.count,
      acc.tips,
      acc.cost,
      serviceType,
    );
  }

  return {
    byArtist,
    byService,
    totalRevenue: roundMoney(totalRevenue),
    totalTips: roundMoney(totalTips),
    appointmentCount,
    flags: buildFlags(statusCounts),
  };
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const startDate = startOfDayUtc(date);
  const endDate = endOfDayUtc(date);
  const period = await buildPeriodMetrics(startDate, endDate);
  return {
    date,
    ...period,
  };
}

export async function getWeeklySummary(
  start: string,
  end: string,
): Promise<WeeklySummary> {
  const startDate = startOfDayUtc(start);
  const endDate = endOfDayUtc(end);
  const period = await buildPeriodMetrics(startDate, endDate);
  return {
    start,
    end,
    ...period,
  };
}

export async function getMonthlySummary(
  year: number,
  month: number,
): Promise<MonthlySummary> {
  const { start, end, label } = monthRange(year, month);
  const [aggregates, artists] = await Promise.all([
    revenueRepo.getPaymentAggregatesByArtistAndService(start, end),
    artistRepo.listActiveArtists(),
  ]);

  const artistNames = buildArtistNameMap(artists);
  const byArtist: Record<string, MonthlyArtistMetrics> = {};
  const byService: Partial<Record<ServiceType, MonthlyServiceMetrics>> = {};

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalPayroll = 0;
  let appointmentCount = 0;

  for (const row of aggregates) {
    totalRevenue += row.revenue;
    totalCogs += row.cost;
    totalPayroll += row.artistPayout;
    appointmentCount += row.count;

    const existingArtist = byArtist[row.artistId];
    if (existingArtist) {
      existingArtist.revenue = roundMoney(existingArtist.revenue + row.revenue);
      existingArtist.payout = roundMoney(existingArtist.payout + row.artistPayout);
      existingArtist.appointmentCount += row.count;
      existingArtist.margin = calculateShopMarginPercent(
        existingArtist.revenue,
        existingArtist.payout,
      );
    } else {
      byArtist[row.artistId] = {
        artistName: artistNames.get(row.artistId) ?? "Unknown Artist",
        revenue: roundMoney(row.revenue),
        payout: roundMoney(row.artistPayout),
        margin: calculateShopMarginPercent(row.revenue, row.artistPayout),
        appointmentCount: row.count,
      };
    }

    const existingService = byService[row.serviceType];
    if (existingService) {
      existingService.revenue = roundMoney(existingService.revenue + row.revenue);
      existingService.count += row.count;
      existingService.tips = roundMoney(existingService.tips + row.tips);
      existingService.cogs = roundMoney(existingService.cogs + row.cost);
      existingService.artistPayouts = roundMoney(
        existingService.artistPayouts + row.artistPayout,
      );
      existingService.shopMargin = roundMoney(
        calculateShopMargin(existingService.revenue, existingService.artistPayouts),
      );
      existingService.profit = roundMoney(
        calculateServiceProfit(
          existingService.revenue,
          existingService.cogs > 0 ? existingService.cogs : null,
          row.serviceType,
        ),
      );
      existingService.margin = calculateMarginPercent(
        existingService.revenue,
        existingService.profit,
      );
      existingService.avgValue =
        existingService.count > 0
          ? roundMoney(existingService.revenue / existingService.count)
          : 0;
    } else {
      const profit = calculateServiceProfit(
        row.revenue,
        row.cost > 0 ? row.cost : null,
        row.serviceType,
      );
      byService[row.serviceType] = {
        revenue: roundMoney(row.revenue),
        count: row.count,
        avgValue: row.count > 0 ? roundMoney(row.revenue / row.count) : 0,
        tips: roundMoney(row.tips),
        profit: roundMoney(profit),
        margin: calculateMarginPercent(row.revenue, profit),
        cogs: roundMoney(row.cost),
        artistPayouts: roundMoney(row.artistPayout),
        shopMargin: roundMoney(calculateShopMargin(row.revenue, row.artistPayout)),
        volumePercent: 0,
      };
    }
  }

  totalRevenue = roundMoney(totalRevenue);
  totalCogs = roundMoney(totalCogs);
  totalPayroll = roundMoney(totalPayroll);
  const netProfit = roundMoney(totalRevenue - totalCogs - totalPayroll);

  for (const serviceType of Object.keys(byService) as ServiceType[]) {
    const service = byService[serviceType];
    if (service) {
      service.volumePercent =
        totalRevenue > 0 ? roundMoney(service.revenue / totalRevenue) : 0;
    }
  }

  return {
    month: label,
    totalRevenue,
    totalCosts: {
      cogs: totalCogs,
      payroll: totalPayroll,
    },
    netProfit,
    marginPercent: calculateMarginPercent(totalRevenue, netProfit),
    byArtist,
    byService,
    appointmentCount,
  };
}

export interface YtdSummary {
  totalRevenue: number;
  totalShopProfit: number;
  appointmentCount: number;
  avgBookingValue: number;
  projectedAnnualRevenue: number;
  priorYearRevenue: number;
  growthRatePct: number;
  daysSinceJanFirst: number;
}

function ytdRangeForYear(year: number, asOf: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  if (year < asOf.getUTCFullYear()) {
    return {
      start,
      end: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
  }
  if (year > asOf.getUTCFullYear()) {
    return { start, end: start };
  }
  return { start, end: asOf };
}

function daysSinceJanFirstUtc(year: number, asOf: Date): number {
  const janFirst = Date.UTC(year, 0, 1);
  const asOfMidnight = Date.UTC(
    asOf.getUTCFullYear(),
    asOf.getUTCMonth(),
    asOf.getUTCDate(),
  );
  return Math.max(1, Math.floor((asOfMidnight - janFirst) / (1000 * 60 * 60 * 24)) + 1);
}

async function sumRevenueForRange(start: Date, end: Date): Promise<{
  totalRevenue: number;
  appointmentCount: number;
}> {
  const aggregates = await revenueRepo.getPaymentAggregatesByArtistAndService(start, end);
  let totalRevenue = 0;
  let appointmentCount = 0;
  for (const row of aggregates) {
    totalRevenue += row.revenue;
    appointmentCount += row.count;
  }
  return {
    totalRevenue: roundMoney(totalRevenue),
    appointmentCount,
  };
}

export async function getYtdSummary(shopId: string, year: number): Promise<YtdSummary> {
  const now = new Date();
  const effectiveAsOf =
    year === now.getUTCFullYear()
      ? now
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const { start, end } = ytdRangeForYear(year, effectiveAsOf);
  const priorYear = year - 1;
  const priorAsOf = new Date(
    Date.UTC(priorYear, effectiveAsOf.getUTCMonth(), effectiveAsOf.getUTCDate(), 23, 59, 59, 999),
  );
  const priorRange = ytdRangeForYear(priorYear, priorAsOf);

  const [currentRevenue, priorRevenue, aggregates, expenseTotal] = await Promise.all([
    sumRevenueForRange(start, end),
    sumRevenueForRange(priorRange.start, priorRange.end),
    revenueRepo.getPaymentAggregatesByArtistAndService(start, end),
    expenseRepo.sumExpensesByPeriod(shopId, start, end),
  ]);

  let totalCogs = 0;
  let totalPayroll = 0;
  for (const row of aggregates) {
    totalCogs += row.cost;
    totalPayroll += row.artistPayout;
  }
  const totalShopProfit = roundMoney(
    currentRevenue.totalRevenue - roundMoney(totalCogs) - roundMoney(totalPayroll) - roundMoney(expenseTotal),
  );

  const daysSinceJanFirst = daysSinceJanFirstUtc(year, effectiveAsOf);
  const avgBookingValue =
    currentRevenue.appointmentCount > 0
      ? roundMoney(currentRevenue.totalRevenue / currentRevenue.appointmentCount)
      : 0;
  const projectedAnnualRevenue = roundMoney(
    (currentRevenue.totalRevenue / daysSinceJanFirst) * 365,
  );
  const growthRatePct =
    priorRevenue.totalRevenue > 0
      ? roundMoney(
          ((currentRevenue.totalRevenue - priorRevenue.totalRevenue) /
            priorRevenue.totalRevenue) *
            100,
        )
      : 0;

  return {
    totalRevenue: currentRevenue.totalRevenue,
    totalShopProfit,
    appointmentCount: currentRevenue.appointmentCount,
    avgBookingValue,
    projectedAnnualRevenue,
    priorYearRevenue: priorRevenue.totalRevenue,
    growthRatePct,
    daysSinceJanFirst,
  };
}
