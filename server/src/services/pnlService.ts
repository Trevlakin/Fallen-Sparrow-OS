/**
 * P&L summary: revenue − COGS − payroll − fixed expenses (MASTER_SPEC_v3 Sprint 5B).
 * Commission tiers: per session revenue (Sprint 9A), not period average.
 */
import {
  calculateMarginPercent,
  calculateServiceProfit,
  calculateShopMargin,
  roundMoney,
  roundPercent,
  type ServiceType,
} from "../lib/profit.js";
import { getCommissionRate, type ArtistPayoutMethod } from "@fallen-sparrow/shared/constants";
import { SERVICE_TYPE_LABELS, type SchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import * as artistRepo from "../repos/artistRepo.js";
import * as expenseRepo from "../repos/expenseRepo.js";
import * as pnlRepo from "../repos/pnlRepo.js";
import * as revenueRepo from "../repos/revenueRepo.js";
import * as commissionService from "./commissionService.js";
import * as metricsService from "./metricsService.js";
import { AppError } from "../utils/errors.js";

export interface PnlServiceLine {
  revenue: number;
  cogs: number;
  payroll: number;
  profit: number;
  margin: number;
  volumePercent: number;
  appointmentCount: number;
}

export interface PnlArtistLine {
  artistName: string;
  revenue: number;
  payout: number;
  shopKeepsPercent: number;
  appointmentCount: number;
  tierLabel: string;
}

export interface PnlArtistSession {
  paymentId: string;
  appointmentId: string;
  date: string;
  clientName: string | null;
  serviceLabel: string;
  sessionRevenue: number;
  tierLabel: string;
  artistReceivesPercent: number;
  shopKeepsPercent: number;
  artistPayout: number;
  shopShare: number;
  paid: boolean;
  artistPaidAt: string | null;
  payoutMethod: ArtistPayoutMethod | null;
}

export interface PnlArtistSessionsResult {
  artistId: string;
  artistName: string;
  periodStart: string;
  periodEnd: string;
  sessions: PnlArtistSession[];
  totals: {
    revenue: number;
    payout: number;
    shopShare: number;
    paidCount: number;
    unpaidCount: number;
  };
}

export function tierLabelFromArtistPct(artistPct: number): string {
  return artistPct >= 0.7 ? "70/30" : "60/40";
}

export function tierLabelForSessionRevenues(revenues: number[]): string {
  if (revenues.length === 0) return "60/40";
  const labels = new Set(
    revenues.map((r) => tierLabelFromArtistPct(getCommissionRate(r).artistPct)),
  );
  if (labels.size > 1) return "Mixed";
  return [...labels][0] ?? "60/40";
}

function sessionCommissionFields(revenue: number): {
  tierLabel: string;
  artistPct: number;
  shopPct: number;
  expectedArtistPayout: number;
  expectedShopShare: number;
} {
  const { artistPct, shopPct } = getCommissionRate(revenue);
  return {
    tierLabel: tierLabelFromArtistPct(artistPct),
    artistPct,
    shopPct,
    expectedArtistPayout: roundMoney(revenue * artistPct),
    expectedShopShare: roundMoney(revenue * shopPct),
  };
}

function groupSessionRevenuesByArtist(
  rows: pnlRepo.ArtistSessionRevenueRow[],
): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const list = map.get(row.artistId) ?? [];
    list.push(row.totalRevenue);
    map.set(row.artistId, list);
  }
  return map;
}

function startOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function endOfDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999Z`);
}

function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { start, end };
}

export interface ExpenseCategoryEntry {
  total: number;
  items: Array<{ description: string; amount: number }>;
}

export interface PnlSummary {
  periodStart: string;
  periodEnd: string;
  totalRevenue: number;
  totalCogs: number;
  totalPayroll: number;
  totalFixedExpenses: number;
  netProfit: number;
  marginPercent: number;
  byArtist: Record<string, PnlArtistLine>;
  byService: Partial<Record<ServiceType, PnlServiceLine>>;
  expensesByCategory: Record<string, ExpenseCategoryEntry>;
}

async function buildPnlSummary(
  shopId: string,
  from: Date,
  to: Date,
): Promise<PnlSummary> {
  const [
    aggregates,
    expenseTotal,
    expenseByCategory,
    commissionTotals,
    artists,
    sessionRevenues,
  ] = await Promise.all([
    revenueRepo.getPaymentAggregatesByArtistAndService(from, to),
    expenseRepo.sumExpensesByPeriod(shopId, from, to),
    expenseRepo.listExpensesByCategory(shopId, from, to),
    commissionService.getAllArtistsCommissionSummary(shopId, from, to),
    artistRepo.listArtistsForPicker(),
    pnlRepo.listArtistSessionRevenues(from, to),
  ]);

  const artistNames = new Map(artists.map((a) => [a.id, a.name]));
  const payoutByArtist = new Map(
    commissionTotals.artists.map((a) => [a.artistId, a]),
  );
  const revenuesByArtist = groupSessionRevenuesByArtist(sessionRevenues);
  const byArtist: Record<string, PnlArtistLine> = {};
  const byService: Partial<Record<ServiceType, PnlServiceLine>> = {};

  let totalRevenue = 0;
  let totalCogs = 0;

  const serviceAcc = new Map<
    ServiceType,
    { revenue: number; cogs: number; payroll: number; count: number }
  >();

  for (const row of aggregates) {
    totalRevenue += row.revenue;
    totalCogs += row.cost;

    const existingArtist = byArtist[row.artistId];
    if (existingArtist) {
      existingArtist.revenue = roundMoney(existingArtist.revenue + row.revenue);
      existingArtist.appointmentCount += row.count;
    } else {
      byArtist[row.artistId] = {
        artistName: artistNames.get(row.artistId) ?? "Unknown Artist",
        revenue: roundMoney(row.revenue),
        payout: 0,
        appointmentCount: row.count,
        tierLabel: "60/40",
        shopKeepsPercent: 0,
      };
    }

    const acc = serviceAcc.get(row.serviceType) ?? {
      revenue: 0,
      cogs: 0,
      payroll: 0,
      count: 0,
    };
    acc.revenue += row.revenue;
    acc.cogs += row.cost;
    acc.payroll += row.artistPayout;
    acc.count += row.count;
    serviceAcc.set(row.serviceType, acc);
  }

  for (const [artistId, line] of Object.entries(byArtist)) {
    const comm = payoutByArtist.get(artistId);
    if (comm) {
      line.revenue = comm.totalRevenue;
      line.payout = comm.totalArtistPayout;
      line.appointmentCount = comm.appointmentCount;
    }
    line.tierLabel = tierLabelForSessionRevenues(revenuesByArtist.get(artistId) ?? []);
    line.shopKeepsPercent =
      line.revenue > 0
        ? roundPercent(calculateShopMargin(line.revenue, line.payout) / line.revenue * 100)
        : 0;
  }

  totalRevenue = roundMoney(totalRevenue);
  totalCogs = roundMoney(totalCogs);
  const totalPayroll = roundMoney(commissionTotals.totals.totalArtistPayout);
  const totalFixedExpenses = roundMoney(expenseTotal);
  const netProfit = roundMoney(
    totalRevenue - totalCogs - totalPayroll - totalFixedExpenses,
  );

  for (const [serviceType, acc] of serviceAcc) {
    const profit = calculateServiceProfit(
      acc.revenue,
      acc.cogs > 0 ? acc.cogs : null,
      serviceType,
    );
    byService[serviceType] = {
      revenue: roundMoney(acc.revenue),
      cogs: roundMoney(acc.cogs),
      payroll: roundMoney(acc.payroll),
      profit: roundMoney(profit),
      margin: calculateMarginPercent(acc.revenue, profit),
      volumePercent:
        totalRevenue > 0 ? roundMoney(acc.revenue / totalRevenue) : 0,
      appointmentCount: acc.count,
    };
  }

  const expensesByCategory: Record<string, ExpenseCategoryEntry> = {};
  for (const row of expenseByCategory) {
    expensesByCategory[row.category] = {
      total: roundMoney(row.total),
      items: row.items,
    };
  }

  return {
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    totalRevenue,
    totalCogs,
    totalPayroll,
    totalFixedExpenses,
    netProfit,
    marginPercent: calculateMarginPercent(totalRevenue, netProfit),
    byArtist,
    byService,
    expensesByCategory,
  };
}

export async function getPnlSummary(
  shopId: string,
  from: Date,
  to: Date,
): Promise<PnlSummary> {
  return buildPnlSummary(shopId, from, to);
}

export async function getPnlMonthly(
  shopId: string,
  year: number,
  month: number,
): Promise<PnlSummary> {
  const { start, end } = monthRange(year, month);
  const summary = await buildPnlSummary(shopId, start, end);
  const monthly = await metricsService.getMonthlySummary(year, month);
  return {
    ...summary,
    totalRevenue: monthly.totalRevenue,
    totalCogs: monthly.totalCosts.cogs,
    totalPayroll: monthly.totalCosts.payroll,
    netProfit: roundMoney(
      monthly.totalRevenue -
        monthly.totalCosts.cogs -
        monthly.totalCosts.payroll -
        summary.totalFixedExpenses,
    ),
    marginPercent: monthly.marginPercent,
  };
}

export async function getPnlRange(
  shopId: string,
  start: string,
  end: string,
): Promise<PnlSummary> {
  return buildPnlSummary(shopId, startOfDayUtc(start), endOfDayUtc(end));
}

export async function getArtistPnlSessions(
  shopId: string,
  artistId: string,
  start: string,
  end: string,
): Promise<PnlArtistSessionsResult> {
  const from = startOfDayUtc(start);
  const to = endOfDayUtc(end);
  const [rows, artists] = await Promise.all([
    pnlRepo.listArtistPaymentSessions(artistId, from, to),
    artistRepo.listArtistsForPicker(),
  ]);

  const artistName =
    artists.find((a) => a.id === artistId)?.name ?? "Unknown Artist";

  let totalRevenue = 0;
  let totalPayout = 0;
  let paidCount = 0;

  const sessions: PnlArtistSession[] = rows.map((row) => {
    const revenue = roundMoney(row.totalRevenue);
    const payout = roundMoney(row.artistPayout);
    const { tierLabel, artistPct, shopPct } = sessionCommissionFields(revenue);
    const paid = row.artistPaidAt !== null;
    totalRevenue += revenue;
    totalPayout += payout;
    if (paid) paidCount += 1;

    return {
      paymentId: row.paymentId,
      appointmentId: row.appointmentId,
      date: row.paymentDate.toISOString(),
      clientName: row.clientName,
      serviceLabel:
        SERVICE_TYPE_LABELS[row.serviceType as SchemaServiceType] ?? row.serviceType,
      sessionRevenue: revenue,
      tierLabel,
      artistReceivesPercent: roundPercent(artistPct * 100),
      shopKeepsPercent: roundPercent(shopPct * 100),
      artistPayout: payout,
      shopShare: roundMoney(revenue - payout),
      paid,
      artistPaidAt: row.artistPaidAt?.toISOString() ?? null,
      payoutMethod: (row.artistPayoutMethod as ArtistPayoutMethod | null) ?? null,
    };
  });

  return {
    artistId,
    artistName,
    periodStart: from.toISOString(),
    periodEnd: to.toISOString(),
    sessions,
    totals: {
      revenue: roundMoney(totalRevenue),
      payout: roundMoney(totalPayout),
      shopShare: roundMoney(totalRevenue - totalPayout),
      paidCount,
      unpaidCount: sessions.length - paidCount,
    },
  };
}

export async function setArtistSessionPaid(
  _shopId: string,
  artistId: string,
  paymentId: string,
  paid: boolean,
  payoutMethod: ArtistPayoutMethod | null,
): Promise<{
  paymentId: string;
  paid: boolean;
  artistPaidAt: string | null;
  payoutMethod: ArtistPayoutMethod | null;
}> {
  const ownerArtistId = await pnlRepo.findPaymentArtistId(paymentId);
  if (!ownerArtistId || ownerArtistId !== artistId) {
    throw new AppError("Payment not found for this artist", 404);
  }

  const updated = await pnlRepo.setPaymentArtistPayout(
    paymentId,
    paid,
    paid ? payoutMethod : null,
  );
  if (!updated) {
    throw new AppError("Payment not found", 404);
  }

  return {
    paymentId,
    paid,
    artistPaidAt: paid ? new Date().toISOString() : null,
    payoutMethod: paid ? payoutMethod : null,
  };
}
