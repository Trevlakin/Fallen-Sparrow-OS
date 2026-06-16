export interface CsvFieldDef {
  key: string;
  label: string;
  required: boolean;
  hints: string[];
}

export const EXPENSE_CSV_FIELDS: CsvFieldDef[] = [
  { key: "date", label: "Date", required: true, hints: ["date", "when", "posted"] },
  { key: "vendor", label: "Vendor", required: true, hints: ["vendor", "payee", "merchant", "supplier"] },
  { key: "amount", label: "Amount", required: true, hints: ["amount", "total", "cost", "price", "paid"] },
  { key: "category", label: "Category", required: true, hints: ["category", "type", "class", "account"] },
  {
    key: "description",
    label: "Description",
    required: false,
    hints: ["description", "memo", "note", "details"],
  },
];

export const APPOINTMENT_CSV_FIELDS: CsvFieldDef[] = [
  {
    key: "date",
    label: "Date",
    required: true,
    hints: ["date", "appointment", "scheduled", "apt. date"],
  },
  {
    key: "artistName",
    label: "Artist Name",
    required: true,
    hints: ["artist", "provider", "staff"],
  },
  {
    key: "clientName",
    label: "Client Name",
    required: true,
    hints: ["client", "customer", "name"],
  },
  {
    key: "serviceType",
    label: "Service Type",
    required: true,
    hints: ["service", "type", "procedure"],
  },
  {
    key: "totalRevenue",
    label: "Total Revenue",
    required: true,
    hints: ["revenue", "total", "amount", "price", "charged", "total cash"],
  },
  {
    key: "artistPayout",
    label: "Artist Payout",
    required: false,
    hints: ["payout", "commission", "artist pay", "split", "amount sent to artist"],
  },
  { key: "status", label: "Status", required: false, hints: ["status", "state"] },
  { key: "notes", label: "Notes", required: false, hints: ["notes", "comment", "memo"] },
];

const SKIP = "";

function scoreHeader(header: string, hints: string[]): number {
  const h = header.toLowerCase();
  let best = 0;
  for (const hint of hints) {
    if (h === hint) best = Math.max(best, 100);
    else if (h.includes(hint)) best = Math.max(best, 50 + hint.length);
  }
  return best;
}

export function suggestColumnMapping(
  headers: string[],
  fields: CsvFieldDef[],
): Record<string, string> {
  const used = new Set<string>();
  const mapping: Record<string, string> = {};

  for (const field of fields) {
    let bestHeader = "";
    let bestScore = 0;
    for (const header of headers) {
      if (used.has(header)) continue;
      const score = scoreHeader(header, field.hints);
      if (score > bestScore) {
        bestScore = score;
        bestHeader = header;
      }
    }
    if (bestHeader && bestScore >= 40) {
      mapping[field.key] = bestHeader;
      used.add(bestHeader);
    } else if (!field.required) {
      mapping[field.key] = SKIP;
    }
  }

  return mapping;
}

export function buildMappingPayload(
  mapping: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, col] of Object.entries(mapping)) {
    if (col && col !== SKIP) {
      out[key] = col;
    }
  }
  return out;
}

export function isMappingComplete(
  mapping: Record<string, string>,
  fields: CsvFieldDef[],
): boolean {
  return fields
    .filter((f) => f.required)
    .every((f) => Boolean(mapping[f.key]?.trim()) && mapping[f.key] !== SKIP);
}
