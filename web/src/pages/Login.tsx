import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

const STARTUP_RETRY_MS = 2_000;
const STARTUP_MAX_ATTEMPTS = 15;
const DEMO_PASSWORD = "ChangeMe123!";

const DEMO_ACCOUNTS = [
  { label: "Legion (Owner)", email: "owner@fallensparrow.local" },
  { label: "Hector (Manager)", email: "hector@fallensparrow.local" },
  { label: "Front Desk", email: "frontdesk@fallensparrow.local" },
  { label: "Carlos (Artist)", email: "carlos@fallensparrow.local" },
] as const;

const isDevLoginHelper = import.meta.env.DEV || import.meta.env.MODE === "development";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@fallensparrow.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingUp, setStartingUp] = useState(false);
  const credentialsRef = useRef({ email: "", password: "" });

  const attemptLogin = useCallback(
    async (loginEmail: string, loginPassword: string, attempt = 0): Promise<void> => {
      try {
        await login(loginEmail, loginPassword);
        setStartingUp(false);
        navigate("/");
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 503 && attempt < STARTUP_MAX_ATTEMPTS) {
          setStartingUp(true);
          setError(null);
          await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_MS));
          return attemptLogin(loginEmail, loginPassword, attempt + 1);
        }

        setStartingUp(false);
        if (err instanceof ApiError) {
          if (err.statusCode === 503) {
            setError("Database did not start in time. Run: pnpm dev");
          } else if (err.statusCode >= 500) {
            setError("API server is not running. In the project folder run: pnpm dev");
          } else {
            setError(err.message);
          }
        } else {
          setError("Cannot reach the API. Run: pnpm dev");
        }
      }
    },
    [login, navigate],
  );

  // If a token exists, ProtectedRoute handles the redirect; show connecting state here too.
  useEffect(() => {
    if (!loading && user) return;
    const hasToken = Boolean(localStorage.getItem("fs_token"));
    if (hasToken && !user && !loading) {
      setStartingUp(true);
    }
  }, [loading, user]);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    credentialsRef.current = { email, password };
    await attemptLogin(email, password);
    setSubmitting(false);
  };

  const fillDemoAccount = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
  };

  const busy = submitting || startingUp;

  return (
    <div className="login-page">
      <PwaInstallPrompt />
      <form className="login-card" onSubmit={(e) => void handleSubmit(e)}>
        <span className="wordmark">FALLEN SPARROW</span>
        <h1>Studio Management</h1>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={busy}
          />
        </label>
        {startingUp && !error && (
          <p className="login-status-text">Starting database, please wait...</p>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn-amber btn-full" disabled={busy}>
          {startingUp ? "Connecting..." : submitting ? "Signing in..." : "Sign In"}
        </button>
        {isDevLoginHelper && (
          <div className="login-demo">
            <p className="login-demo-title">Preview as employee</p>
            <div className="login-demo-accounts">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  className="login-demo-btn"
                  disabled={busy}
                  onClick={() => fillDemoAccount(account.email)}
                >
                  {account.label}
                </button>
              ))}
            </div>
            <p className="login-demo-maintenance">
              <Link to="/sop-checklist">Maintenance checklist (JP, PIN 7777)</Link>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
