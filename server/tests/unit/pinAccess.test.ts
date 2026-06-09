import { describe, expect, it } from "vitest";
import {
  hasDashboardAccess,
  ROLE_PERMISSIONS,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";
import { resolveAuditUserId } from "../../src/services/authService.js";

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

describe("resolveAuditUserId", () => {
  it("returns user id for email/password sessions", () => {
    expect(
      resolveAuditUserId({
        sub: "user-uuid-1",
        email: "owner@example.com",
        role: "OWNER",
      }),
    ).toBe("user-uuid-1");
  });

  it("returns undefined for PIN sessions (team member id is not users.id)", () => {
    expect(
      resolveAuditUserId({
        sub: "team-member-uuid-1",
        email: "pin-team-member-uuid-1@staff.internal",
        role: "OWNER",
        authType: "pin",
        displayName: "Legion A",
      }),
    ).toBeUndefined();
  });
});
