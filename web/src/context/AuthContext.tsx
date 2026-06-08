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
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ user: AuthUser }>("/api/auth/me");
      setUser(res.user);
    } catch (err) {
      // Only clear the stored token when the server explicitly rejects auth (401/403).
      // A network error or 5xx (e.g. API starting up, Postgres not ready) should NOT
      // wipe credentials — the user was previously logged in and the token is still valid.
      if (err instanceof ApiError && (err.statusCode === 401 || err.statusCode === 403)) {
        setToken(null);
      }
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: AuthUser }>("/api/auth/login", {
      email,
      password,
    });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
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
