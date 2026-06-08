export type PeriodKey =
  | "today"
  | "this_week"
  | "this_month"
  | "this_quarter"
  | "ytd"
  | "full_year"
  | "custom";

export interface TimelineRange {
  from: string;
  to: string;
  year: number;
  period: PeriodKey;
  label: string;
}

function startOfWeekMonday(d: Date): Date {
  const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setUTCDate(copy.getUTCDate() - diff);
  return copy;
}

function quarterStart(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3);
  return new Date(Date.UTC(d.getUTCFullYear(), q * 3, 1));
}

export function buildTimelineRange(
  year: number,
  period: PeriodKey,
  customFrom?: string,
  customTo?: string,
): TimelineRange {
  const now = new Date();
  const useYear = year;
  const ref =
    useYear === now.getUTCFullYear()
      ? now
      : new Date(Date.UTC(useYear, 11, 31, 12, 0, 0));

  let from: Date;
  let to: Date;
  let label: string;

  switch (period) {
    case "today": {
      from = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
      to = from;
      label = "Today";
      break;
    }
    case "this_week": {
      from = startOfWeekMonday(ref);
      to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
      label = "This Week";
      break;
    }
    case "this_month": {
      from = new Date(Date.UTC(useYear, ref.getUTCMonth(), 1));
      to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
      label = "This Month";
      break;
    }
    case "this_quarter": {
      from = quarterStart(ref);
      to = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate()));
      label = "This Quarter";
      break;
    }
    case "ytd": {
      from = new Date(Date.UTC(useYear, 0, 1));
      to =
        useYear === now.getUTCFullYear()
          ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
          : new Date(Date.UTC(useYear, 11, 31));
      label = "YTD";
      break;
    }
    case "full_year": {
      from = new Date(Date.UTC(useYear, 0, 1));
      to = new Date(Date.UTC(useYear, 11, 31));
      label = "Full Year";
      break;
    }
    case "custom": {
      from = customFrom
        ? new Date(`${customFrom}T00:00:00.000Z`)
        : new Date(Date.UTC(useYear, 0, 1));
      to = customTo
        ? new Date(`${customTo}T00:00:00.000Z`)
        : new Date(Date.UTC(useYear, 11, 31));
      label = "Custom Range";
      break;
    }
    default: {
      from = new Date(Date.UTC(useYear, 0, 1));
      to = new Date(Date.UTC(useYear, 11, 31));
      label = "Full Year";
    }
  }

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);

  return {
    from: fromStr,
    to: toStr,
    year: useYear,
    period,
    label,
  };
}

export function isYtdOrFullYear(period: PeriodKey): boolean {
  return period === "ytd" || period === "full_year";
}
