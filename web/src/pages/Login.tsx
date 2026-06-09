import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/authMessages";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { routeAfterPinLogin } from "@/lib/pinRouting";
import {
  clearExpiredPinSession,
  clearPinAttempts,
  getPinLockoutRemainingMs,
  isPinSession,
  isPinSessionExpired,
  recordPinFailure,
} from "@/lib/pinSession";
import { setChecklistSessionToken } from "@/lib/checklistApi";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";

const STARTUP_RETRY_MS = 3_000;
const STARTUP_MAX_ATTEMPTS = 20;

type LoginView = "choice" | "admin" | "pin";

const PIN_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export function LoginPage() {
  const { login, pinLogin, loading, sessionError, clearSessionError, user } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<LoginView>("choice");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startingUp, setStartingUp] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);
  const [shakePin, setShakePin] = useState(false);
  const [lockoutMs, setLockoutMs] = useState(0);
  const credentialsRef = useRef({ email: "", password: "" });

  const displayError = error ?? sessionError;
  const isLockedOut = lockoutMs > 0;

  useEffect(() => {
    clearExpiredPinSession();
    setChecklistSessionToken(null);
  }, []);

  useEffect(() => {
    const tick = () => {
      setLockoutMs(getPinLockoutRemainingMs());
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isPinSession() && !isPinSessionExpired() && user?.authType === "pin") {
      navigate(routeAfterPinLogin(user.role as TeamMemberRole), { replace: true });
    }
  }, [loading, user, navigate]);

  const attemptLogin = useCallback(
    async (loginEmail: string, loginPassword: string, attempt = 0): Promise<void> => {
      try {
        clearSessionError();
        await login(loginEmail, loginPassword);
        setStartingUp(false);
        navigate("/dashboard");
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
            setError(DATABASE_UNAVAILABLE_MESSAGE);
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
    [clearSessionError, login, navigate],
  );

  const triggerShake = () => {
    setShakePin(true);
    window.setTimeout(() => setShakePin(false), 500);
  };

  const submitPin = useCallback(
    async (pinValue: string) => {
      if (isLockedOut || pinSubmitting) return;
      setPinError("");
      setPinSubmitting(true);
      try {
        const pinUser = await pinLogin(pinValue);
        clearPinAttempts();
        navigate(routeAfterPinLogin(pinUser.role as TeamMemberRole), { replace: true });
      } catch (err) {
        const locked = recordPinFailure();
        triggerShake();
        if (locked) {
          setLockoutMs(getPinLockoutRemainingMs());
          setPinError("Too many attempts. Try again in 5 minutes.");
        } else if (err instanceof ApiError) {
          setPinError(err.message || "Invalid PIN");
        } else {
          setPinError("Invalid PIN");
        }
      } finally {
        setPinSubmitting(false);
        setPin("");
      }
    },
    [isLockedOut, pinSubmitting, pinLogin, navigate],
  );

  const appendPinDigit = (digit: string) => {
    if (isLockedOut || pinSubmitting || pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      void submitPin(next);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    clearSessionError();
    setSubmitting(true);
    credentialsRef.current = { email, password };
    await attemptLogin(email, password);
    setSubmitting(false);
  };

  const formDisabled = submitting || startingUp;

  const lockoutMinutes = Math.ceil(lockoutMs / 60_000);

  if (view === "pin") {
    return (
      <div className="login-page">
        <div className="login-page-stack login-pin-stack">
          <div className="login-card login-pin-card">
            <button
              type="button"
              className="login-pin-back"
              onClick={() => {
                setView("choice");
                setPin("");
                setPinError("");
              }}
            >
              ← Back
            </button>
            <h1 className="login-pin-title">Enter your PIN</h1>
            <div
              className={`login-pin-dots${shakePin ? " login-pin-dots--shake" : ""}`}
              aria-live="polite"
            >
              {[0, 1, 2, 3].map((index) => (
                <span
                  key={index}
                  className={`login-pin-dot${index < pin.length ? " login-pin-dot--filled" : ""}`}
                  aria-hidden
                />
              ))}
            </div>
            {isLockedOut ? (
              <p className="pin-error">
                Too many attempts. Try again in {lockoutMinutes} minute
                {lockoutMinutes === 1 ? "" : "s"}.
              </p>
            ) : (
              pinError && <p className="pin-error">{pinError}</p>
            )}
            <div className="pin-keypad login-pin-keypad">
              {PIN_KEYS.slice(0, 9).map((digit) => (
                <button
                  key={digit}
                  type="button"
                  className="pin-key"
                  disabled={isLockedOut || pinSubmitting}
                  onClick={() => appendPinDigit(digit)}
                >
                  {digit}
                </button>
              ))}
              <span className="pin-key-spacer" aria-hidden />
              <button
                type="button"
                className="pin-key"
                disabled={isLockedOut || pinSubmitting}
                onClick={() => appendPinDigit("0")}
              >
                0
              </button>
              <span className="pin-key-spacer" aria-hidden />
            </div>
            <button
              type="button"
              className="btn-text login-pin-clear"
              disabled={isLockedOut || pinSubmitting || pin.length === 0}
              onClick={() => {
                setPin("");
                setPinError("");
              }}
            >
              Clear
            </button>
          </div>
          <PwaInstallPrompt />
        </div>
      </div>
    );
  }

  if (view === "admin") {
    return (
      <div className="login-page">
        <div className="login-page-stack">
          <form className="login-card" onSubmit={(e) => void handleSubmit(e)}>
            <button
              type="button"
              className="login-pin-back"
              onClick={() => {
                setView("choice");
                setError(null);
                clearSessionError();
              }}
            >
              ← Back
            </button>
            <span className="wordmark">FALLEN SPARROW OPERATING SYSTEM</span>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={formDisabled}
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
                disabled={formDisabled}
                autoComplete="current-password"
              />
            </label>
            {loading && !displayError && (
              <p className="login-status-text">Checking your session...</p>
            )}
            {startingUp && !displayError && (
              <p className="login-status-text">Connecting to studio, please wait...</p>
            )}
            {displayError && <p className="error-text">{displayError}</p>}
            <button type="submit" className="btn-amber btn-full" disabled={formDisabled}>
              {startingUp
                ? "Connecting..."
                : submitting
                  ? "Signing in..."
                  : loading
                    ? "Sign In"
                    : "Sign In"}
            </button>
          </form>
          <PwaInstallPrompt />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-page-stack">
        <div className="login-card login-choice-card">
          <span className="wordmark">FALLEN SPARROW OPERATING SYSTEM</span>
          <button
            type="button"
            className="btn-amber btn-full login-staff-btn"
            onClick={() => {
              setView("pin");
              setPin("");
              setPinError("");
            }}
          >
            <span className="login-staff-btn-title">Staff Check-In</span>
            <span className="login-staff-btn-sub">Enter your PIN</span>
          </button>
          <div className="login-divider">
            <span>or</span>
          </div>
          <button
            type="button"
            className="btn-ghost btn-full login-admin-btn"
            onClick={() => setView("admin")}
          >
            Admin Login
          </button>
          <p className="login-demo-maintenance">
            <Link to="/sop-checklist">Staff opening checklist</Link>
          </p>
        </div>
        <PwaInstallPrompt />
      </div>
    </div>
  );
}
