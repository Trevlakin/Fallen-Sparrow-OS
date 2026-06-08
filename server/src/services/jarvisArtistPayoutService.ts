/**
 * JARVIS: parse artist payout messages and match unpaid P&L sessions for owner confirmation.
 */
import { z } from "zod";
import {
  ARTIST_PAYOUT_METHODS,
  ARTIST_PAYOUT_METHOD_LABELS,
  getCommissionRate,
  type ArtistPayoutMethod,
} from "@fallen-sparrow/shared/constants";
import { SERVICE_TYPE_LABELS, type SchemaServiceType } from "@fallen-sparrow/shared/serviceTypes";
import { callClaude } from "../integrations/anthropic.js";
import { roundMoney } from "../lib/profit.js";
import * as artistRepo from "../repos/artistRepo.js";
import * as pnlRepo from "../repos/pnlRepo.js";
import * as pnlService from "./pnlService.js";
import { AppError } from "../utils/errors.js";

const LOOKBACK_DAYS = 120;
const AMOUNT_TOLERANCE = 1.0;

const ExtractedPayoutSchema = z.object({
  artistName: z.string().min(1),
  amount: z.number().positive(),
  payoutMethod: z.enum(ARTIST_PAYOUT_METHODS).nullable().optional(),
  confidence: z.number().min(0).max(1),
});

export interface JarvisPayoutSessionProposal {
  paymentId: string;
  date: string;
  clientName: string | null;
  serviceLabel: string;
  sessionRevenue: number;
  artistPayout: number;
  tierLabel: string;
}

export interface JarvisPayoutProposal {
  artistId: string;
  artistName: string;
  amount: number;
  payoutMethod: ArtistPayoutMethod;
  sessions: JarvisPayoutSessionProposal[];
  matchConfidence: number;
  message: string;
}

function stripMarkdownFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function normalizePayoutMethod(raw: string | null | undefined): ArtistPayoutMethod | null {
  if (!raw) return null;
  const n = raw.toLowerCase().replace(/\s+/g, "_");
  if (n.includes("zelle")) return "zelle";
  if (n.includes("cash_app") || n.includes("cashapp") || n.includes("cash app")) return "cash_app";
  if (n.includes("cash")) return "cash";
  return null;
}

async function extractArtistPayoutFromText(
  input: string,
): Promise<z.infer<typeof ExtractedPayoutSchema>> {
  const methods = ARTIST_PAYOUT_METHODS.map(
    (m) => `${m} (${ARTIST_PAYOUT_METHOD_LABELS[m]})`,
  ).join(", ");

  const rawJson = await callClaude({
    systemPrompt: `Extract artist payout details from this message. The speaker (Hector or Legion) paid an ARTIST, not themselves.
Return JSON only. No markdown.
Fields:
- artistName (string, the tattoo artist who received payment, e.g. "Carlos", "Carlos M", "Riley")
- amount (number, total dollars paid to the artist)
- payoutMethod (one of: ${methods}, or null if not stated)
- confidence (0.0-1.0)

Map payment method phrases: "cash app" -> cash_app, "venmo" -> null, "zelle" -> zelle.
Return ONLY valid JSON.`,
    userMessage: input,
    maxTokens: 300,
  });

  try {
    const parsed = ExtractedPayoutSchema.parse(JSON.parse(stripMarkdownFences(rawJson)));
    const method =
      normalizePayoutMethod(parsed.payoutMethod ?? undefined) ?? parsed.payoutMethod ?? null;
    return { ...parsed, payoutMethod: method };
  } catch {
    throw new AppError(
      "Could not parse artist payout. Include artist name, amount, and payment method (cash, Zelle, or Cash App).",
      422,
    );
  }
}

function resolveArtistByHint(
  hint: string,
  artists: artistRepo.ArtistPickerRow[],
): artistRepo.ArtistPickerRow | undefined {
  const lower = hint.toLowerCase().trim();
  if (!lower) return undefined;

  const exact = artists.find((a) => a.name.toLowerCase() === lower);
  if (exact) return exact;

  const contains = artists.filter(
    (a) =>
      a.name.toLowerCase().includes(lower) ||
      lower.includes(a.name.toLowerCase()),
  );
  if (contains.length === 1) return contains[0];

  const firstToken = lower.split(/\s+/)[0] ?? lower;
  const byFirst = artists.filter((a) => {
    const nameLower = a.name.toLowerCase();
    const firstName = nameLower.split(/\s+/)[0] ?? nameLower;
    return firstName === firstToken || nameLower.startsWith(`${firstToken} `);
  });
  if (byFirst.length === 1) return byFirst[0];

  return undefined;
}

interface UnpaidSessionCandidate {
  paymentId: string;
  paymentDate: Date;
  clientName: string | null;
  serviceType: string;
  totalRevenue: number;
  artistPayout: number;
}

function amountsClose(a: number, b: number): boolean {
  return Math.abs(a - b) <= AMOUNT_TOLERANCE;
}

/** Pick unpaid sessions whose payouts sum closest to the stated amount. */
export function matchUnpaidSessionsToAmount(
  sessions: UnpaidSessionCandidate[],
  targetAmount: number,
): { sessions: UnpaidSessionCandidate[]; confidence: number } | null {
  if (sessions.length === 0) return null;

  const single = sessions.find((s) => amountsClose(s.artistPayout, targetAmount));
  if (single) {
    return { sessions: [single], confidence: 0.95 };
  }

  const totalUnpaid = roundMoney(
    sessions.reduce((sum, s) => sum + s.artistPayout, 0),
  );
  if (amountsClose(totalUnpaid, targetAmount)) {
    return { sessions, confidence: 0.9 };
  }

  const sorted = [...sessions].sort(
    (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime(),
  );
  let sum = 0;
  const picked: UnpaidSessionCandidate[] = [];
  for (const s of sorted) {
    picked.push(s);
    sum = roundMoney(sum + s.artistPayout);
    if (sum >= targetAmount - AMOUNT_TOLERANCE) break;
  }
  if (picked.length > 0 && amountsClose(sum, targetAmount)) {
    return { sessions: picked, confidence: 0.82 };
  }

  const firstPicked = picked[0];
  if (firstPicked && picked.length === 1 && amountsClose(firstPicked.artistPayout, targetAmount)) {
    return { sessions: picked, confidence: 0.95 };
  }

  if (picked.length > 0 && picked.length <= 8) {
    const diff = Math.abs(sum - targetAmount);
    if (diff <= Math.max(50, targetAmount * 0.05)) {
      return { sessions: picked, confidence: 0.65 };
    }
  }

  return null;
}

function sessionToProposal(row: UnpaidSessionCandidate): JarvisPayoutSessionProposal {
  const revenue = roundMoney(row.totalRevenue);
  const payout = roundMoney(row.artistPayout);
  const { artistPct } = getCommissionRate(revenue);
  const tierLabel = pnlService.tierLabelFromArtistPct(artistPct);
  return {
    paymentId: row.paymentId,
    date: row.paymentDate.toISOString(),
    clientName: row.clientName,
    serviceLabel:
      SERVICE_TYPE_LABELS[row.serviceType as SchemaServiceType] ?? row.serviceType,
    sessionRevenue: revenue,
    artistPayout: payout,
    tierLabel,
  };
}

export async function proposeArtistPayoutFromJarvis(
  rawText: string,
): Promise<JarvisPayoutProposal> {
  const extracted = await extractArtistPayoutFromText(rawText);
  const artists = await artistRepo.listArtistsForPicker();
  const artist = resolveArtistByHint(extracted.artistName, artists);

  if (!artist) {
    throw new AppError(
      `Could not find artist "${extracted.artistName}". Check the name and try again.`,
      404,
    );
  }

  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - LOOKBACK_DAYS);

  const unpaidRows = await pnlRepo.listUnpaidArtistPaymentSessions(
    artist.id,
    from,
    to,
  );

  if (unpaidRows.length === 0) {
    throw new AppError(
      `No unpaid sessions found for ${artist.name} in the last ${LOOKBACK_DAYS} days.`,
      404,
    );
  }

  const match = matchUnpaidSessionsToAmount(unpaidRows, extracted.amount);
  if (!match) {
    const unpaidTotal = roundMoney(
      unpaidRows.reduce((s, r) => s + r.artistPayout, 0),
    );
    throw new AppError(
      `Could not match $${extracted.amount.toFixed(0)} to unpaid sessions for ${artist.name}. Unpaid total is $${unpaidTotal.toFixed(0)} across ${unpaidRows.length} session(s). Open P&L to mark sessions manually.`,
      422,
    );
  }

  const payoutMethod =
    extracted.payoutMethod ??
    normalizePayoutMethod(rawText) ??
    "cash";

  const sessionProposals = match.sessions.map(sessionToProposal);
  const matchedTotal = roundMoney(
    sessionProposals.reduce((s, x) => s + x.artistPayout, 0),
  );
  const methodLabel = ARTIST_PAYOUT_METHOD_LABELS[payoutMethod];
  const sessionWord = sessionProposals.length === 1 ? "session" : "sessions";

  const message = [
    `• Matched ${artist.name}: $${matchedTotal.toFixed(0)} across ${sessionProposals.length} unpaid ${sessionWord}.`,
    `• Payment method: ${methodLabel}.`,
    `• Review below and tap Confirm to mark paid in P&L.`,
  ].join("\n");

  return {
    artistId: artist.id,
    artistName: artist.name,
    amount: extracted.amount,
    payoutMethod,
    sessions: sessionProposals,
    matchConfidence: Math.min(extracted.confidence, match.confidence),
    message,
  };
}

export async function confirmArtistPayoutFromJarvis(
  artistId: string,
  paymentIds: string[],
  payoutMethod: ArtistPayoutMethod,
): Promise<{ markedCount: number; message: string }> {
  if (paymentIds.length === 0) {
    throw new AppError("No sessions selected", 400);
  }

  let markedCount = 0;
  for (const paymentId of paymentIds) {
    await pnlService.setArtistSessionPaid(
      "",
      artistId,
      paymentId,
      true,
      payoutMethod,
    );
    markedCount += 1;
  }

  const methodLabel = ARTIST_PAYOUT_METHOD_LABELS[payoutMethod];
  return {
    markedCount,
    message: `• Marked ${markedCount} session${markedCount === 1 ? "" : "s"} paid for this artist via ${methodLabel}.`,
  };
}

export function looksLikeArtistPayoutLog(input: string): boolean {
  const n = input.toLowerCase();
  const payoutVerb =
    n.includes("paid") ||
    n.includes("pay out") ||
    n.includes("payout") ||
    n.includes("sent") ||
    n.includes("gave");
  const hasMoney = /\$?\s*\d+/.test(n);
  const hasArtistContext =
    n.includes("artist") ||
    n.includes("carlos") ||
    n.includes("riley") ||
    n.includes("legion") ||
    n.includes("taylor") ||
    n.includes("nataly") ||
    n.includes("zelle") ||
    n.includes("cash app") ||
    n.includes("cashapp");
  return payoutVerb && hasMoney && (hasArtistContext || n.includes(" via "));
}
