export interface ROIInputs {
  lCharge: number;
  lAdmin: number;
  hRate: number;
  hAdmin: number;
  setup: number;
  fee: number;
  bookkeepingCost: number;
}

export interface ROIResults {
  monthlyHrsFreed: number;
  extraSessions: number;
  sessionRevenue: number;
  hectorHrsFreed: number;
  hectorGain: number;
  net: number;
  breakEvenMonths: number;
  yr1: number;
}

export const SESSION_LENGTH_HRS = 3;
export const ADMIN_TIME_SAVED_PCT = 0.4;
export const WEEKS_PER_MONTH = 4.33;

export const DEFAULT_ROI_INPUTS: ROIInputs = {
  lCharge: 578,
  lAdmin: 10,
  hRate: 35,
  hAdmin: 10,
  setup: 10_000,
  fee: 550,
  bookkeepingCost: 200,
};

const UNACHIEVABLE_BREAK_EVEN = 999;

export const ROI_HERO_CONTEXT =
  "Extra revenue and recovered time, after the monthly maintenance fee.";

export const ROI_DISCLAIMER =
  "Extra sessions calculated assuming a 3-hour avg session. Estimated gain before taxes and existing operating costs.";

export const ROI_YEAR1_SUB_LABEL =
  "after setup, maintenance fees, and all costs";

export function formatRoiCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(Math.round(value));
}

export function computeROI(inputs: ROIInputs): ROIResults {
  const monthlyHrsFreed =
    inputs.lAdmin * WEEKS_PER_MONTH * ADMIN_TIME_SAVED_PCT;
  const extraSessions = monthlyHrsFreed / SESSION_LENGTH_HRS;
  const sessionRevenue = extraSessions * inputs.lCharge;
  const hectorHrsFreed =
    inputs.hAdmin * WEEKS_PER_MONTH * ADMIN_TIME_SAVED_PCT;
  const hectorGain = hectorHrsFreed * inputs.hRate;
  const net = sessionRevenue + hectorGain - inputs.fee - inputs.bookkeepingCost;
  const breakEvenMonths =
    net > 0 ? inputs.setup / net : UNACHIEVABLE_BREAK_EVEN;
  const yr1 = net * 12 - inputs.setup;

  return {
    monthlyHrsFreed,
    extraSessions,
    sessionRevenue,
    hectorHrsFreed,
    hectorGain,
    net,
    breakEvenMonths,
    yr1,
  };
}

export function formatBreakEvenDisplay(breakEvenMonths: number): string {
  return breakEvenMonths < UNACHIEVABLE_BREAK_EVEN
    ? breakEvenMonths.toFixed(1)
    : "12+";
}

export function buildRoiCopySummary(
  inputs: ROIInputs,
  results: ROIResults,
): string {
  return [
    "Fallen Sparrow - ROI Summary",
    "",
    `Legion (extra sessions): ${formatRoiCurrency(results.sessionRevenue)}/mo`,
    `Hector (time freed): ${formatRoiCurrency(results.hectorGain)}/mo`,
    `System cost: (${formatRoiCurrency(inputs.fee)}/mo)`,
    `Bookkeeping cost: (${formatRoiCurrency(inputs.bookkeepingCost)}/mo)`,
    "",
    `Estimated monthly gain: ${formatRoiCurrency(results.net)}/mo`,
    ROI_HERO_CONTEXT,
    "",
    `Break-even: ${formatBreakEvenDisplay(results.breakEvenMonths)} months`,
    `Year 1 net gain: ${formatRoiCurrency(results.yr1)}`,
    "",
    "Before taxes and existing operating costs.",
  ].join("\n");
}
