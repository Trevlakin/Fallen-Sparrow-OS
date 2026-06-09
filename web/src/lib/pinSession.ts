import { setToken } from "./api.js";

export const PIN_AUTH_TYPE_KEY = "fs_auth_type";
export const PIN_EXPIRES_KEY = "fs_pin_expires_at";
export const PIN_LOCKOUT_KEY = "fs_pin_lockout_until";
export const PIN_ATTEMPTS_KEY = "fs_pin_attempts";

export const PIN_SESSION_MS = 8 * 60 * 60 * 1000;
export const PIN_LOCKOUT_MS = 5 * 60 * 1000;
export const PIN_MAX_ATTEMPTS = 3;

export function setPinSession(token: string): void {
  setToken(token);
  localStorage.setItem(PIN_AUTH_TYPE_KEY, "pin");
  localStorage.setItem(PIN_EXPIRES_KEY, String(Date.now() + PIN_SESSION_MS));
}

export function clearPinSessionMetadata(): void {
  localStorage.removeItem(PIN_AUTH_TYPE_KEY);
  localStorage.removeItem(PIN_EXPIRES_KEY);
}

export function clearAdminSessionMetadata(): void {
  clearPinSessionMetadata();
}

export function isPinSession(): boolean {
  return localStorage.getItem(PIN_AUTH_TYPE_KEY) === "pin";
}

export function isPinSessionExpired(): boolean {
  const expiresAt = localStorage.getItem(PIN_EXPIRES_KEY);
  if (!expiresAt) return false;
  return Date.now() > Number(expiresAt);
}

export function clearExpiredPinSession(): boolean {
  if (isPinSession() && isPinSessionExpired()) {
    setToken(null);
    clearPinSessionMetadata();
    return true;
  }
  return false;
}

export function getPinLockoutRemainingMs(): number {
  const lockoutUntil = localStorage.getItem(PIN_LOCKOUT_KEY);
  if (!lockoutUntil) return 0;
  const remaining = Number(lockoutUntil) - Date.now();
  if (remaining <= 0) {
    localStorage.removeItem(PIN_LOCKOUT_KEY);
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    return 0;
  }
  return remaining;
}

export function recordPinFailure(): boolean {
  const current = Number(localStorage.getItem(PIN_ATTEMPTS_KEY) ?? "0") + 1;
  localStorage.setItem(PIN_ATTEMPTS_KEY, String(current));
  if (current >= PIN_MAX_ATTEMPTS) {
    localStorage.setItem(PIN_LOCKOUT_KEY, String(Date.now() + PIN_LOCKOUT_MS));
    localStorage.removeItem(PIN_ATTEMPTS_KEY);
    return true;
  }
  return false;
}

export function clearPinAttempts(): void {
  localStorage.removeItem(PIN_ATTEMPTS_KEY);
  localStorage.removeItem(PIN_LOCKOUT_KEY);
}
