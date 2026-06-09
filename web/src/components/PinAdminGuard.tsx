import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { hasDashboardAccess } from "@fallen-sparrow/shared/constants";
import { useAuth } from "@/context/AuthContext";

/** Checklist-only PIN roles cannot use the admin app shell. */
export function PinAdminGuard({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.authType === "pin" && !hasDashboardAccess(user.role)) {
    return <Navigate to="/checklist" replace />;
  }

  return <>{children}</>;
}
