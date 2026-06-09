import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  hasManagerAccess,
  MANAGER_ACCESS_ROLES,
  type TeamMemberRole,
  type UserRole,
} from "@fallen-sparrow/shared/constants";
import { clearExpiredPinSession } from "@/lib/pinSession";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
  redirectTo?: string;
  deniedMessage?: string;
}

const SESSION_CONFIRM_MS = 8_000;

export function ProtectedRoute({
  children,
  roles,
  redirectTo = "/",
  deniedMessage = "You do not have access to that page",
}: ProtectedRouteProps) {
  const { user, loading, sessionError } = useAuth();
  const { showToast } = useToast();
  const [timedOut, setTimedOut] = useState(false);

  const hasToken = Boolean(localStorage.getItem("fs_token"));

  useEffect(() => {
    clearExpiredPinSession();
  }, []);

  useEffect(() => {
    if (!loading && !user && hasToken && !timedOut && !sessionError) {
      const timeout = setTimeout(() => {
        setTimedOut(true);
      }, SESSION_CONFIRM_MS);
      return () => {
        clearTimeout(timeout);
      };
    }
    return undefined;
  }, [loading, user, hasToken, timedOut, sessionError]);

  const denied = Boolean(
    user &&
      roles &&
      !userHasRequiredRole(user.role, roles),
  );

  useEffect(() => {
    if (denied) {
      showToast(deniedMessage, "error");
    }
  }, [denied, deniedMessage, showToast]);

  if (sessionError) {
    return <Navigate to="/login" replace />;
  }

  if (loading || (!user && hasToken && !timedOut)) {
    return <div className="page-loading">Connecting...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (denied) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}

function userHasRequiredRole(
  userRole: UserRole | TeamMemberRole,
  allowed: UserRole[],
): boolean {
  const isManagerOnlyRoute =
    allowed.length === MANAGER_ACCESS_ROLES.length &&
    allowed.includes("OWNER") &&
    allowed.includes("MANAGER");
  if (isManagerOnlyRoute) {
    return hasManagerAccess(userRole);
  }
  return (allowed as readonly string[]).includes(userRole);
}
