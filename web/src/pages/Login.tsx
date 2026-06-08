import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";

const STARTUP_RETRY_MS = 2_000;
const STARTUP_MAX_ATTEMPTS = 15;

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
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
            setError("Studio is starting up. Try again in a moment.");
          } else if (err.statusCode >= 500) {
            setError("Something went wrong. Try again shortly.");
          } else {
            setError(err.message);
          }
        } else {
          setError("Cannot reach the studio server. Check your connection and try again.");
        }
      }
    },
    [login, navigate],
  );

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

  const busy = submitting || startingUp;

  return (
    <div className="login-page">
      <PwaInstallPrompt />
      <form className="login-card" onSubmit={(e) => void handleSubmit(e)}>
        <span className="wordmark">FALLEN SPARROW OPERATING SYSTEM</span>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={busy}
            placeholder="your@email.com"
            autoComplete="email"
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
            autoComplete="current-password"
          />
        </label>
        {startingUp && !error && (
          <p className="login-status-text">Connecting to studio, please wait...</p>
        )}
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="btn-amber btn-full" disabled={busy}>
          {startingUp ? "Connecting..." : submitting ? "Signing in..." : "Sign In"}
        </button>
        <p className="login-demo-maintenance">
          <Link to="/sop-checklist">Staff opening checklist</Link>
        </p>
      </form>
    </div>
  );
}
