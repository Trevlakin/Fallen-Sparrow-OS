const PG_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "08001",
  "08003",
  "08006",
  "57P01",
  "57P03",
  "42P01",
  "3F000",
]);

function readPgCode(value: unknown): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  if ("code" in value && typeof value.code === "string") {
    return value.code;
  }
  if ("cause" in value) {
    return readPgCode(value.cause);
  }
  return null;
}

export function getPgErrorCode(err: unknown): string | null {
  return readPgCode(err);
}

export function isDatabaseUnavailableError(err: unknown): boolean {
  const code = getPgErrorCode(err);
  return code !== null && PG_UNAVAILABLE_CODES.has(code);
}
