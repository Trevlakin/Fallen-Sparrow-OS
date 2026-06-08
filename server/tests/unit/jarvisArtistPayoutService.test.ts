import { describe, expect, it } from "vitest";
import { matchUnpaidSessionsToAmount } from "../../src/services/jarvisArtistPayoutService.js";

describe("matchUnpaidSessionsToAmount", () => {
  const sessions = [
    {
      paymentId: "a",
      paymentDate: new Date("2026-05-01"),
      clientName: null,
      serviceType: "tattoo",
      totalRevenue: 500,
      artistPayout: 300,
    },
    {
      paymentId: "b",
      paymentDate: new Date("2026-05-02"),
      clientName: null,
      serviceType: "tattoo",
      totalRevenue: 1200,
      artistPayout: 840,
    },
  ];

  it("matches a single session by exact payout", () => {
    const result = matchUnpaidSessionsToAmount(sessions, 300);
    expect(result?.sessions).toHaveLength(1);
    expect(result?.sessions[0]?.paymentId).toBe("a");
  });

  it("matches all sessions when total equals amount", () => {
    const result = matchUnpaidSessionsToAmount(sessions, 1140);
    expect(result?.sessions).toHaveLength(2);
  });
});
