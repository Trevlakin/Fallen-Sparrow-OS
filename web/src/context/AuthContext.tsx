import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { hasManagerAccess, type UserRole } from "@fallen-sparrow/shared/constants";
import { api, setToken, ApiError } from "@/lib/api";
import {
  DATABASE_UNAVAILABLE_MESSAGE,
  SESSION_CHECK_TIMEOUT_MESSAGE,
} from "@/lib/authMessages";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  clearSessionError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_CHECK_TIMEOUT_MS = 10_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const clearSessionError = useCallback(() => {
    setSessionError(null);
  }, []);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("fs_token");
    if (!token) {
      setUser(null);
      return;
    }

    try {
      const res = await api.get<{ user: AuthUser }>("/api/auth/me");
      setUser(res.user);
      setSessionError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          setToken(null);
        } else if (err.statusCode === 503) {
          setToken(null);
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
    setToken(res.token);
    setUser(res.user);
    setSessionError(null);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setSessionError(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      sessionError,
      login,
      logout,
      refresh,
      clearSessionError,
    }),
    [user, loading, sessionError, login, logout, refresh, clearSessionError],
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
