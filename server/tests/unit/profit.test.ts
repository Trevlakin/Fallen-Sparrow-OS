import { describe, expect, it } from "vitest";
import {
  calculateMarginPercent,
  calculateShopMargin,
  calculateShopMarginPercent,
} from "../../src/lib/profit.js";

describe("calculateMarginPercent", () => {
  it("returns net profit as a percentage of revenue", () => {
    // Revenue $128k, net profit $30,360 -> 23.7%
    expect(calculateMarginPercent(128_000, 30_360)).toBeCloseTo(23.7188, 3);
  });

  it("returns 0 when revenue is zero or negative", () => {
    expect(calculateMarginPercent(0, 100)).toBe(0);
    expect(calculateMarginPercent(-100, 50)).toBe(0);
  });
});

describe("calculateShopMarginPercent", () => {
  it("returns shop share after artist payout as a percentage", () => {
    expect(calculateShopMarginPercent(1000, 500)).toBe(50);
    expect(calculateShopMargin(1000, 500)).toBe(500);
  });
});
