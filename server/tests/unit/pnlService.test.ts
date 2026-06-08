import { describe, expect, it } from "vitest";
import {
  tierLabelForSessionRevenues,
  tierLabelFromArtistPct,
} from "../../src/services/pnlService.js";
import { getCommissionRate } from "@fallen-sparrow/shared/constants";

describe("pnlService commission tiers", () => {
  it("labels 60/40 vs 70/30 from artist percent", () => {
    expect(tierLabelFromArtistPct(0.6)).toBe("60/40");
    expect(tierLabelFromArtistPct(0.7)).toBe("70/30");
  });

  it("uses per-session tier, not period average", () => {
    const revenues = [500, 500, 1500];
    const perSessionPayout = revenues.reduce((sum, r) => {
      const { artistPct } = getCommissionRate(r);
      return sum + r * artistPct;
    }, 0);
    const periodAverage = revenues.reduce((a, b) => a + b, 0) / revenues.length;
    const { artistPct: avgPct } = getCommissionRate(periodAverage);
    const payoutFromAverage = revenues.reduce((a, b) => a + b, 0) * avgPct;

    expect(perSessionPayout).not.toBe(payoutFromAverage);
    expect(tierLabelForSessionRevenues(revenues)).toBe("Mixed");
  });

  it("shows single tier when all sessions qualify the same", () => {
    expect(tierLabelForSessionRevenues([400, 800])).toBe("60/40");
    expect(tierLabelForSessionRevenues([1200, 2000])).toBe("70/30");
  });
});
