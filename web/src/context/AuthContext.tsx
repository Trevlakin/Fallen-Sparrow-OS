import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  hasManagerAccess,
  type TeamMemberRole,
  type UserRole,
} from "@fallen-sparrow/shared/constants";
import { api, setToken, ApiError } from "@/lib/api";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  SESSION_CHECK_TIMEOUT_MESSAGE,
} from "@/lib/authMessages";
import {
  clearExpiredPinSession,
  clearPinSessionMetadata,
  setPinSession,
} from "@/lib/pinSession";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole | TeamMemberRole;
  authType?: "pin";
  displayName?: string;
}

/** True for PIN-based staff sessions (synthetic @staff.internal email). */
export function isPinSessionUser(user: AuthUser): boolean {
  if (user.authType === "pin") return true;
  const email = user.email.toLowerCase();
  return email.includes("@staff.internal") || email.startsWith("pin-");
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  pinLogin: (pin: string) => Promise<AuthUser>;
  logout: () => void;
  refresh: () => Promise<void>;
  clearSessionError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_CHECK_TIMEOUT_MS = 10_000;

function mapMeResponse(user: AuthUser): AuthUser {
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (clearExpiredPinSession()) {
      setUser(null);
      return;
    }

    const token = localStorage.getItem("fs_token");
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<{ user: AuthUser }>("/api/auth/me");
      setUser(mapMeResponse(res.user));
      setSessionError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          setToken(null);
          clearPinSessionMetadata();
        } else if (err.statusCode === 503) {
          setToken(null);
          clearPinSessionMetadata();
          setSessionError(DATABASE_UNAVAILABLE_MESSAGE);
        }
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setSessionError((prev) => prev ?? SESSION_CHECK_TIMEOUT_MESSAGE);
      }
    }, SESSION_CHECK_TIMEOUT_MS);

    void (async () => {
      await refresh();
      if (!cancelled) {
        clearTimeout(timeout);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", {
      email,
      password,
    });
    clearPinSessionMetadata();
    setToken(res.token);
    setUser(res.user);
    setSessionError(null);
  }, []);

  const pinLogin = useCallback(async (pin: string) => {
    const res = await api.post<{
      token: string;
      employeeId: string;
      name: string;
      role: TeamMemberRole;
    }>("/api/auth/pin-login", { pin });

    setPinSession(res.token);
    const pinUser: AuthUser = {
      id: res.employeeId,
      email: `pin-${res.employeeId}@staff.internal`,
      firstName: res.name.split(/\s+/)[0] ?? res.name,
      lastName: res.name.split(/\s+/).slice(1).join(" "),
      role: res.role,
      authType: "pin",
      displayName: res.name,
    };
    setUser(pinUser);
    setSessionError(null);
    return pinUser;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    clearPinSessionMetadata();
    setUser(null);
    setSessionError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      login,
      pinLogin,
      logout,
      refresh,
      clearSessionError,
    }),
    [user, loading, sessionError, login, pinLogin, logout, refresh, clearSessionError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useCanViewFinancials(): boolean {
  const { user } = useAuth();
  return hasManagerAccess(user?.role);
}

export function useIsManager(): boolean {
  const { user } = useAuth();
  return hasManagerAccess(user?.role);
}

export function useIsOwner(): boolean {
  const { user } = useAuth();
  return user?.role === "OWNER";
}

export function useIsFrontDesk(): boolean {
  const { user } = useAuth();
  return user?.role === "FRONT_DESK";
}

export function useCanSendNudge(): boolean {
  const { user } = useAuth();
  return hasManagerAccess(user?.role);
}
