import { describe, expect, it } from "vitest";
import {
  isSearchQueryValid,
  normalizeSearchQuery,
} from "../../src/services/searchService.js";

describe("searchService", () => {
  it("normalizes and caps query length", () => {
    const long = "  " + "a".repeat(200);
    expect(normalizeSearchQuery(long).length).toBe(120);
    expect(normalizeSearchQuery("  tattoo  ")).toBe("tattoo");
  });

  it("requires at least two characters", () => {
    expect(isSearchQueryValid("")).toBe(false);
    expect(isSearchQueryValid("a")).toBe(false);
    expect(isSearchQueryValid("ab")).toBe(true);
  });
});
