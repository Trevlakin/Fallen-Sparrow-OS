import { describe, expect, it } from "vitest";
import { SCHEMA_SERVICE_TYPES } from "@fallen-sparrow/shared/serviceTypes";

describe("manual sale schema service types", () => {
  it("includes laser for individual sale logging", () => {
    expect(SCHEMA_SERVICE_TYPES).toContain("laser");
  });
});
