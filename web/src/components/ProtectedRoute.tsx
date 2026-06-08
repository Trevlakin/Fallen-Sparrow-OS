import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import {
  hasManagerAccess,
  MANAGER_ACCESS_ROLES,
  type UserRole,
} from "@fallen-sparrow/shared/constants";

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
  redirectTo?: string;
  deniedMessage?: string;
}

// How long to wait for a token-bearing session to be confirmed before
// redirecting to login. This covers the "API is still starting" window.
const SESSION_CONFIRM_MS = 8_000;

export function ProtectedRoute({
  children,
  roles,
  redirectTo = "/",
  deniedMessage = "You do not have access to that page",
}: ProtectedRouteProps) {
  const { user, loading, refresh } = useAuth();
  const { showToast } = useToast();
  const [timedOut, setTimedOut] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasToken = Boolean(localStorage.getItem("fs_token"));

  // If we have a stored token but no user yet (loading still resolving or
  // the first refresh hit a dead server), retry once more before giving up.
  useEffect(() => {
    if (!loading && !user && hasToken && !timedOut) {
      const delay = 2_000;
      retryRef.current = setTimeout(() => {
        void refresh();
      }, delay);
      const timeout = setTimeout(() => {
        setTimedOut(true);
      }, SESSION_CONFIRM_MS);
      return () => {
        clearTimeout(retryRef.current ?? 0);
        clearTimeout(timeout);
      };
    }
    return undefined;
  }, [loading, user, hasToken, timedOut, refresh]);

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

  // Still loading or waiting for retry
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

function userHasRequiredRole(userRole: UserRole, allowed: UserRole[]): boolean {
  const isManagerOnlyRoute =
    allowed.length === MANAGER_ACCESS_ROLES.length &&
    allowed.includes("OWNER") &&
    allowed.includes("MANAGER");
  if (isManagerOnlyRoute) {
    return hasManagerAccess(userRole);
  }
  return allowed.includes(userRole);
}
