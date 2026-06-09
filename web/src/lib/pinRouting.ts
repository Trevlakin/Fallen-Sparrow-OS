import {
  hasDashboardAccess,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";

/** Admin-capable PIN roles land in the full app; staff stay on checklist-only. */
export function routeAfterPinLogin(role: TeamMemberRole | string): string {
  if (hasDashboardAccess(role)) {
    return "/dashboard";
  }
  return "/checklist";
}
