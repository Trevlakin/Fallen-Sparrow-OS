import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ARTIST_PAYOUT_METHOD_LABELS,
  ARTIST_PAYOUT_METHODS,
  type ArtistPayoutMethod,
} from "@fallen-sparrow/shared/constants";
import { api } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useToast } from "@/context/ToastContext";

export interface PnlArtistSession {
  paymentId: string;
  appointmentId: string;
  date: string;
  clientName: string | null;
  serviceLabel: string;
  sessionRevenue: number;
  tierLabel: string;
  artistReceivesPercent: number;
  shopKeepsPercent: number;
  artistPayout: number;
  shopShare: number;
  paid: boolean;
  artistPaidAt: string | null;
  payoutMethod: ArtistPayoutMethod | null;
}

export interface PnlArtistSessionsResponse {
  artistId: string;
  artistName: string;
  periodStart: string;
  periodEnd: string;
  sessions: PnlArtistSession[];
  totals: {
    revenue: number;
    payout: number;
    shopShare: number;
    paidCount: number;
    unpaidCount: number;
  };
}

interface PatchPaidResponse {
  paymentId: string;
  paid: boolean;
  artistPaidAt: string | null;
  payoutMethod: ArtistPayoutMethod | null;
}

interface PnlArtistSessionsDrawerProps {
  artistId: string | null;
  artistName: string;
  start: string;
  end: string;
  onClose: () => void;
  onPaidChange?: () => void;
}

function formatSessionDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function lastUsedPayoutMethod(sessions: PnlArtistSession[]): ArtistPayoutMethod | null {
  const paidWithMethod = sessions
    .filter((s) => s.paid && s.payoutMethod && s.artistPaidAt)
    .sort(
      (a, b) =>
        new Date(b.artistPaidAt ?? 0).getTime() - new Date(a.artistPaidAt ?? 0).getTime(),
    );
  return paidWithMethod[0]?.payoutMethod ?? null;
}

export function PnlArtistSessionsDrawer({
  artistId,
  artistName,
  start,
  end,
  onClose,
  onPaidChange,
}: PnlArtistSessionsDrawerProps) {
  const { showToast } = useToast();
  const [data, setData] = useState<PnlArtistSessionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingMethods, setPendingMethods] = useState<Record<string, ArtistPayoutMethod>>({});

  const defaultMethod = useMemo(
    () => (data ? lastUsedPayoutMethod(data.sessions) : null),
    [data],
  );

  const loadSessions = useCallback(() => {
    if (!artistId) {
      setData(null);
      return;
    }
    setLoading(true);
    void api
      .get<PnlArtistSessionsResponse>(
        `/api/pnl/artists/${artistId}/sessions?start=${start}&end=${end}`,
      )
      .then((response) => {
        setData(response);
        const lastMethod = lastUsedPayoutMethod(response.sessions);
        if (lastMethod) {
          setPendingMethods((prev) => {
            const next = { ...prev };
            for (const session of response.sessions) {
              if (!session.paid && !next[session.paymentId]) {
                next[session.paymentId] = lastMethod;
              }
            }
            return next;
          });
        }
      })
      .catch(() => {
        setData(null);
        showToast("Could not load sessions", "error");
      })
      .finally(() => setLoading(false));
  }, [artistId, start, end, showToast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const applySessionUpdate = (
    paymentId: string,
    patch: Pick<PnlArtistSession, "paid" | "artistPaidAt" | "payoutMethod">,
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      const sessions = prev.sessions.map((s) =>
        s.paymentId === paymentId ? { ...s, ...patch } : s,
      );
      const paidCount = sessions.filter((s) => s.paid).length;
      return {
        ...prev,
        sessions,
        totals: {
          ...prev.totals,
          paidCount,
          unpaidCount: sessions.length - paidCount,
        },
      };
    });
  };

  const patchPaid = async (
    session: PnlArtistSession,
    paid: boolean,
    payoutMethod: ArtistPayoutMethod | null,
  ) => {
    if (!artistId) return;
    setUpdatingId(session.paymentId);
    try {
      const result = await api.patch<PatchPaidResponse>(
        `/api/pnl/artists/${artistId}/sessions/${session.paymentId}/paid`,
        paid ? { paid: true, payoutMethod: payoutMethod ?? undefined } : { paid: false },
      );
      applySessionUpdate(session.paymentId, {
        paid: result.paid,
        artistPaidAt: result.artistPaidAt,
        payoutMethod: result.payoutMethod,
      });
      if (!paid) {
        setPendingMethods((prev) => {
          const next = { ...prev };
          delete next[session.paymentId];
          return next;
        });
      }
      onPaidChange?.();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update payout", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const togglePaid = async (session: PnlArtistSession) => {
    const nextPaid = !session.paid;
    if (nextPaid) {
      const method = session.payoutMethod ?? pendingMethods[session.paymentId] ?? defaultMethod;
      if (!method) {
        showToast("Select a payout method before marking paid", "error");
        return;
      }
      await patchPaid(session, true, method);
      return;
    }
    await patchPaid(session, false, null);
  };

  const selectMethod = (session: PnlArtistSession, method: ArtistPayoutMethod) => {
    if (session.paid) {
      void patchPaid(session, true, method);
      return;
    }
    setPendingMethods((prev) => ({ ...prev, [session.paymentId]: method }));
  };

  const sessionMethod = (session: PnlArtistSession): ArtistPayoutMethod | null =>
    session.paid ? session.payoutMethod : (pendingMethods[session.paymentId] ?? null);

  if (!artistId) return null;

  return (
    <div className="drawer-overlay" onClick={onClose} role="presentation">
      <div
        className="drawer-panel pnl-sessions-drawer"
        role="dialog"
        aria-labelledby="pnl-sessions-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="pnl-sessions-drawer-title">{artistName}</h2>
        <p className="text-muted pnl-sessions-drawer-sub">
          Sessions {start} to {end}. Split labels are artist/shop (e.g. 60/40 means artist 60%,
          shop 40%). Tier applies per session based on that session&apos;s revenue.
        </p>

        {loading && <p className="text-muted">Loading sessions…</p>}
        {!loading && data && (
          <>
            <div className="drawer-stats pnl-sessions-totals">
              <div>
                <span className="label">Revenue</span>
                <span>{formatCurrency(data.totals.revenue)}</span>
              </div>
              <div>
                <span className="label">Artist payout</span>
                <span className="value-amber">{formatCurrency(data.totals.payout)}</span>
              </div>
              <div>
                <span className="label">Shop share</span>
                <span>{formatCurrency(data.totals.shopShare)}</span>
              </div>
              <div>
                <span className="label">Paid</span>
                <span>
                  {data.totals.paidCount} / {data.sessions.length}
                </span>
              </div>
            </div>

            {data.sessions.length === 0 ? (
              <p className="text-muted">No completed sessions in this period.</p>
            ) : (
              <div className="pnl-sessions-table-wrap">
                <table className="pnl-sessions-table">
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Client / service</th>
                      <th scope="col">Revenue</th>
                      <th scope="col">Tier</th>
                      <th scope="col">Payout</th>
                      <th scope="col">Method</th>
                      <th scope="col">Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessions.map((session) => {
                      const selected = sessionMethod(session);
                      const busy = updatingId === session.paymentId;
                      return (
                        <tr key={session.paymentId}>
                          <td>{formatSessionDate(session.date)}</td>
                          <td>
                            <span className="pnl-session-client">
                              {session.clientName ?? "Walk-in"}
                            </span>
                            <span className="pnl-session-service text-muted">
                              {session.serviceLabel}
                            </span>
                          </td>
                          <td>{formatCurrency(session.sessionRevenue)}</td>
                          <td>
                            <span className="pnl-tier-badge">{session.tierLabel}</span>
                            <span className="pnl-session-tier-detail text-muted">
                              Artist {formatPercent(session.artistReceivesPercent)} · Shop{" "}
                              {formatPercent(session.shopKeepsPercent)}
                            </span>
                          </td>
                          <td>
                            <span>{formatCurrency(session.artistPayout)}</span>
                            <span className="pnl-session-tier-detail text-muted">
                              Shop {formatCurrency(session.shopShare)}
                            </span>
                          </td>
                          <td>
                            <div
                              className="pnl-payout-methods"
                              role="group"
                              aria-label="Payout method"
                            >
                              {ARTIST_PAYOUT_METHODS.map((method) => (
                                <button
                                  key={method}
                                  type="button"
                                  className={`pnl-payout-method-btn${
                                    selected === method ? " is-selected" : ""
                                  }`}
                                  disabled={busy}
                                  aria-pressed={selected === method}
                                  onClick={() => selectMethod(session, method)}
                                >
                                  {ARTIST_PAYOUT_METHOD_LABELS[method]}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <label className="pnl-paid-toggle">
                              <input
                                type="checkbox"
                                checked={session.paid}
                                disabled={busy}
                                onChange={() => void togglePaid(session)}
                              />
                              <span>{session.paid ? "Paid" : "Unpaid"}</span>
                            </label>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
