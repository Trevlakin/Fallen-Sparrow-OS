/**
 * Service type normalization and display labels.
 * Schema enum: tattoo | piercing | laser | other
 */

export const SCHEMA_SERVICE_TYPES = [
  "tattoo",
  "piercing",
  "laser",
  "other",
] as const;

export type SchemaServiceType = (typeof SCHEMA_SERVICE_TYPES)[number];

/** CSV imports may use "merchandise" before mapping to schema "other". */
export const CSV_SERVICE_TYPES = [
  "tattoo",
  "piercing",
  "laser",
  "merchandise",
  "other",
] as const;

export type CsvServiceType = (typeof CSV_SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABELS: Record<SchemaServiceType, string> = {
  tattoo: "Tattoo",
  piercing: "Piercing",
  laser: "Laser Removal",
  other: "Merchandise",
};

function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").replace(/_/g, " ");
}

/**
 * Normalize a raw CSV or Porter service type string to a CSV-level type.
 * Handles human-readable labels like "Laser Removal" and "Merchandise".
 */
export function normalizeCsvServiceType(raw: string): CsvServiceType {
  const key = normalizeKey(raw);
  if (!key) return "other";

  if (key === "tattoo") return "tattoo";
  if (key === "piercing") return "piercing";
  if (key === "laser") return "laser";
  if (key === "merchandise" || key === "merch") return "merchandise";
  if (key === "other") return "other";

  if (key.includes("laser") || key === "lhr") return "laser";
  if (key.includes("pierc")) return "piercing";
  if (key.includes("merch")) return "merchandise";
  if (key.includes("tattoo")) return "tattoo";

  return "other";
}

export function toSchemaServiceType(
  serviceType: CsvServiceType,
): SchemaServiceType {
  if (serviceType === "merchandise") return "other";
  return serviceType;
}

/** Normalize raw input directly to a schema service type enum value. */
export function normalizeSchemaServiceType(raw: string): SchemaServiceType {
  return toSchemaServiceType(normalizeCsvServiceType(raw));
}
