/** Production API host when VITE_API_BASE_URL was not set at build time. */
const PRODUCTION_API_BASE = "https://api.fallensparrowos.com";

export function getApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return configured;
  }
  if (import.meta.env.PROD) {
    return PRODUCTION_API_BASE;
  }
  return "";
}
