import {
  ROLE_PERMISSIONS,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";

export function routeAfterPinLogin(role: TeamMemberRole): string {
  if (ROLE_PERMISSIONS[role]?.dashboard) {
    return "/dashboard";
  }
  return "/checklist";
}
