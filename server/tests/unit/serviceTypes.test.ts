import { describe, expect, it } from "vitest";
import {
  normalizeCsvServiceType,
  normalizeSchemaServiceType,
  toSchemaServiceType,
} from "@fallen-sparrow/shared/serviceTypes";

describe("normalizeCsvServiceType", () => {
  it("maps exact lowercase tokens", () => {
    expect(normalizeCsvServiceType("tattoo")).toBe("tattoo");
    expect(normalizeCsvServiceType("piercing")).toBe("piercing");
    expect(normalizeCsvServiceType("laser")).toBe("laser");
    expect(normalizeCsvServiceType("merchandise")).toBe("merchandise");
    expect(normalizeCsvServiceType("other")).toBe("other");
  });

  it("maps human-readable CSV labels", () => {
    expect(normalizeCsvServiceType("Tattoo")).toBe("tattoo");
    expect(normalizeCsvServiceType("Laser Removal")).toBe("laser");
    expect(normalizeCsvServiceType("LASER REMOVAL")).toBe("laser");
    expect(normalizeCsvServiceType("Piercing")).toBe("piercing");
    expect(normalizeCsvServiceType("Merchandise")).toBe("merchandise");
    expect(normalizeCsvServiceType("Merch")).toBe("merchandise");
  });

  it("returns other for unknown values", () => {
    expect(normalizeCsvServiceType("")).toBe("other");
    expect(normalizeCsvServiceType("Consultation")).toBe("other");
  });
});

describe("toSchemaServiceType", () => {
  it("maps merchandise to other for schema storage", () => {
    expect(toSchemaServiceType("merchandise")).toBe("other");
    expect(toSchemaServiceType("laser")).toBe("laser");
  });
});

describe("normalizeSchemaServiceType", () => {
  it("normalizes Porter and CSV strings to schema enum values", () => {
    expect(normalizeSchemaServiceType("Laser Removal")).toBe("laser");
    expect(normalizeSchemaServiceType("Merchandise")).toBe("other");
    expect(normalizeSchemaServiceType("piercing")).toBe("piercing");
  });
});
