/**
 * Service margin and profit helpers (MASTER_SPEC_v3 Sprint 3, adapted from B.O.S.S. profit.ts).
 */
export type ServiceType = "tattoo" | "piercing" | "laser" | "other";

const DEFAULT_MARGINS: Record<ServiceType, number> = {
  tattoo: 0.34,
  piercing: 0.28,
  laser: 0.3,
  other: 0.3,
};

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function roundPercent(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function parseDecimal(value: string | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Shop profit for a service line: actual cost when known, otherwise assumed margin by type.
 */
export function calculateServiceProfit(
  revenue: number,
  actualCost: number | null,
  serviceType: ServiceType,
): number {
  if (revenue <= 0) {
    return 0;
  }
  if (typeof actualCost === "number" && actualCost >= 0) {
    return Math.max(0, revenue - actualCost);
  }
  const marginRate = DEFAULT_MARGINS[serviceType] ?? 0.3;
  return Math.max(0, revenue * marginRate);
}

export function calculateMarginPercent(revenue: number, profit: number): number {
  if (revenue <= 0) {
    return 0;
  }
  return roundPercent((profit / revenue) * 100);
}

export function calculateShopMargin(revenue: number, artistPayout: number): number {
  return Math.max(0, revenue - artistPayout);
}

export function calculateShopMarginPercent(
  revenue: number,
  artistPayout: number,
): number {
  return calculateMarginPercent(revenue, calculateShopMargin(revenue, artistPayout));
}
