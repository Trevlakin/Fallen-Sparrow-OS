import { describe, expect, it } from "vitest";
import {
  hasDashboardAccess,
  ROLE_PERMISSIONS,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";

describe("hasDashboardAccess", () => {
  it("grants dashboard for OWNER and MANAGER", () => {
    expect(hasDashboardAccess("OWNER")).toBe(true);
    expect(hasDashboardAccess("MANAGER")).toBe(true);
  });

  it("denies dashboard for checklist-only staff roles", () => {
    const checklistOnly: TeamMemberRole[] = [
      "FRONT_DESK",
      "ARTIST",
      "CLEANER",
      "MAINTENANCE",
    ];
    for (const role of checklistOnly) {
      expect(hasDashboardAccess(role)).toBe(false);
      expect(ROLE_PERMISSIONS[role].dashboard).toBe(false);
    }
  });
});
