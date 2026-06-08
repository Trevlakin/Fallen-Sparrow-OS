import { useState } from "react";
import {
  ARTIST_PAYOUT_METHODS,
  ARTIST_PAYOUT_METHOD_LABELS,
  type ArtistPayoutMethod,
} from "@fallen-sparrow/shared/constants";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

export interface JarvisPayoutSessionRow {
  paymentId: string;
  date: string;
  clientName: string | null;
  serviceLabel: string;
  sessionRevenue: number;
  artistPayout: number;
  tierLabel: string;
}

export interface JarvisPayoutProposalData {
  artistId: string;
  artistName: string;
  amount: number;
  payoutMethod: ArtistPayoutMethod;
  sessions: JarvisPayoutSessionRow[];
  matchConfidence: number;
  message: string;
}

interface JarvisPayoutProposalProps {
  proposal: JarvisPayoutProposalData;
  message?: string;
  onConfirmed: (resultMessage: string) => void;
  onDismiss: () => void;
}

function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function JarvisPayoutProposal({
  proposal,
  message,
  onConfirmed,
  onDismiss,
}: JarvisPayoutProposalProps) {
  const [payoutMethod, setPayoutMethod] = useState<ArtistPayoutMethod>(proposal.payoutMethod);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchedTotal = proposal.sessions.reduce((s, x) => s + x.artistPayout, 0);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      const result = await api.post<{ markedCount: number; message: string }>(
        "/api/jarvis/payout/confirm",
        {
          artistId: proposal.artistId,
          paymentIds: proposal.sessions.map((s) => s.paymentId),
          payoutMethod,
        },
      );
      onConfirmed(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm payout");
    } finally {
      setConfirming(false);
    }
  };

  const lines = (message ?? proposal.message).split("\n").filter((l) => l.trim());

  return (
    <div className="jarvis-payout-proposal" role="region" aria-label="Artist payout confirmation">
      <div className="jarvis-query-header">
        <span className="jarvis-query-badge jarvis-query-badge-log">Artist payout</span>
      </div>
      <div className="jarvis-query-body">
        {lines.map((line, index) => (
          <p key={`line-${index}`} className="jarvis-query-line jarvis-query-line-bullet">
            {line.trim()}
          </p>
        ))}
      </div>

      <div className="jarvis-payout-summary">
        <strong>{proposal.artistName}</strong>
        <span className="text-muted">
          {proposal.sessions.length} session{proposal.sessions.length === 1 ? "" : "s"} ·{" "}
          {formatCurrency(matchedTotal)} matched
        </span>
      </div>

      <div className="jarvis-payout-method-row">
        <span className="jarvis-payout-method-label">Payment method</span>
        <div className="pnl-payout-method-group jarvis-payout-method-group">
          {ARTIST_PAYOUT_METHODS.map((method) => (
            <button
              key={method}
              type="button"
              className={`pnl-payout-method-btn${payoutMethod === method ? " is-selected" : ""}`}
              onClick={() => setPayoutMethod(method)}
              disabled={confirming}
            >
              {ARTIST_PAYOUT_METHOD_LABELS[method]}
            </button>
          ))}
        </div>
      </div>

      <ul className="jarvis-payout-session-list">
        {proposal.sessions.map((session) => (
          <li key={session.paymentId} className="jarvis-payout-session-item">
            <div className="jarvis-payout-session-main">
              <span className="jarvis-payout-session-date">{formatSessionDate(session.date)}</span>
              <span className="jarvis-payout-session-service">
                {session.serviceLabel}
                {session.clientName ? ` · ${session.clientName}` : ""}
              </span>
            </div>
            <div className="jarvis-payout-session-amounts">
              <span className="pnl-tier-badge">{session.tierLabel}</span>
              <span>{formatCurrency(session.artistPayout)} payout</span>
              <span className="text-muted">{formatCurrency(session.sessionRevenue)} revenue</span>
            </div>
          </li>
        ))}
      </ul>

      {error ? <p className="error-text">{error}</p> : null}

      <div className="jarvis-payout-actions">
        <button type="button" className="btn-dark" onClick={onDismiss} disabled={confirming}>
          Dismiss
        </button>
        <button
          type="button"
          className={`btn-amber${confirming ? " jarvis-send-loading" : ""}`}
          disabled={confirming}
          onClick={() => void handleConfirm()}
        >
          {confirming ? "Confirming…" : "Confirm & mark paid"}
        </button>
      </div>
    </div>
  );
}
