import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  useCanViewFinancials,
  useIsFrontDesk,
  useIsManager,
  useIsOwner,
} from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@/lib/api";
import { emitData, emitJarvisCommitted, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { formatCurrency, toDateInput } from "@/lib/format";
import { BriefingNarrative } from "@/components/BriefingNarrative";
import {
  JarvisResponseRenderer,
  type JarvisIntentResult,
} from "@/components/JarvisResponseRenderer";
import {
  JarvisPayoutProposal,
  type JarvisPayoutProposalData,
} from "@/components/JarvisPayoutProposal";
import { JarvisHelpSummary, JarvisRequestHistory } from "@/pages/Jarvis";

interface Briefing {
  id: string;
  narrative: string | null;
  generatedAt: string | null;
}

interface DailyMetrics {
  appointmentCount: number;
  totalRevenue: number;
}

interface MonthlyMetrics {
  totalRevenue: number;
  appointmentCount: number;
}

interface ParseResult {
  type?: "query_response" | "command_response" | "log_items" | "payout_proposal";
  intent?: "QUERY" | "COMMAND" | "LOG";
  confidence?: number;
  message?: string;
  requiresApproval?: boolean;
  committed: {
    expenses: number;
    incidents: number;
    tasks: number;
    strategicNotes: number;
    inventoryUpdates?: number;
  };
  suggestions: unknown[];
  jarvisResponse?: string;
  payoutProposal?: JarvisPayoutProposalData;
}

interface MyChecklistItem {
  itemId: string;
  label: string;
  completed: boolean;
}

interface MyChecklistResponse {
  sop: {
    id: string;
    title: string;
    frequency: string | null;
  } | null;
  items: MyChecklistItem[];
}

interface SopStatusRow {
  sopId: string;
  sopTitle: string;
  totalItems: number;
  completedToday: number;
  pct: number;
}

interface InventorySnapshotMobile {
  criticalCount: number;
  outCount: number;
}

interface OpenIncidentsResponse {
  incidents: unknown[];
}

function todayISO(): string {
  return toDateInput(new Date());
}

function currentMonthParams(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function MobileHomePage() {
  const isMobile = useIsMobile();
  const isOwner = useIsOwner();
  const isManager = useIsManager();
  const isFrontDesk = useIsFrontDesk();
  const canViewFinancials = useCanViewFinancials();
  const { showToast } = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [daily, setDaily] = useState<DailyMetrics | null>(null);
  const [monthly, setMonthly] = useState<MonthlyMetrics | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [nudgeCount, setNudgeCount] = useState(0);

  const [rawText, setRawText] = useState("");
  const [dumpLoading, setDumpLoading] = useState(false);
  const [jarvisIntentResult, setJarvisIntentResult] = useState<JarvisIntentResult | null>(
    null,
  );
  const [jarvisPayoutProposal, setJarvisPayoutProposal] =
    useState<JarvisPayoutProposalData | null>(null);
  const [jarvisHistoryRefreshKey, setJarvisHistoryRefreshKey] = useState(0);

  const [myChecklist, setMyChecklist] = useState<MyChecklistResponse | null>(null);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [sopStatuses, setSopStatuses] = useState<SopStatusRow[]>([]);
  const [inventorySnap, setInventorySnap] = useState<InventorySnapshotMobile | null>(null);
  const [openIncidentsCount, setOpenIncidentsCount] = useState(0);
  const [dueFollowupsCount, setDueFollowupsCount] = useState(0);

  const loadBriefing = useCallback(async () => {
    if (!isManager) {
      setBriefingLoading(false);
      return;
    }
    setBriefingLoading(true);
    try {
      const res = await api.get<Briefing>("/api/briefing/latest?type=daily");
      setBriefing(res);
    } catch {
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  }, [isManager]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const date = todayISO();
      const { year, month } = currentMonthParams();
      const dailyRes = await api.get<DailyMetrics>(`/api/metrics/daily?date=${date}`);
      setDaily(dailyRes);

      if (!isFrontDesk) {
        const monthlyRes = await api.get<MonthlyMetrics>(
          `/api/metrics/monthly?year=${year}&month=${month}`,
        );
        setMonthly(monthlyRes);
      } else {
        setMonthly(null);
      }
    } catch {
      setDaily(null);
      setMonthly(null);
    } finally {
      setStatsLoading(false);
    }
  }, [isFrontDesk]);

  const loadNudges = useCallback(async () => {
    if (isFrontDesk) return;
    try {
      const res = await api.get<{ candidates: unknown[] }>("/api/nudges/candidates");
      setNudgeCount(res.candidates.length);
    } catch {
      setNudgeCount(0);
    }
  }, [isFrontDesk]);

  const loadMyChecklist = useCallback(async () => {
    setChecklistLoading(true);
    try {
      const res = await api.get<MyChecklistResponse>(
        `/api/sops/my?sessionDate=${todayISO()}`,
      );
      setMyChecklist(res.sop ? res : null);
    } catch {
      setMyChecklist(null);
    } finally {
      setChecklistLoading(false);
    }
  }, []);

  const loadOpsStatus = useCallback(async () => {
    if (!isManager) {
      setSopStatuses([]);
      return;
    }
    try {
      const res = await api.get<{ statuses: SopStatusRow[] }>("/api/sops/status/today");
      setSopStatuses(res.statuses.filter((s) => s.totalItems > 0));
    } catch {
      setSopStatuses([]);
    }
  }, [isManager]);

  const loadInventory = useCallback(async () => {
    try {
      const snap = await api.get<InventorySnapshotMobile>("/api/inventory/snapshot");
      setInventorySnap(snap);
    } catch {
      setInventorySnap(null);
    }
  }, []);

  const loadOpenIncidents = useCallback(async () => {
    if (!isManager) {
      setOpenIncidentsCount(0);
      return;
    }
    try {
      const res = await api.get<OpenIncidentsResponse>("/api/incidents?status=open");
      setOpenIncidentsCount(res.incidents.length);
    } catch {
      setOpenIncidentsCount(0);
    }
  }, [isManager]);

  const loadDueFollowups = useCallback(async () => {
    if (!isManager) {
      setDueFollowupsCount(0);
      return;
    }
    try {
      const res = await api.get<{ followups: unknown[] }>("/api/followups/due-today");
      setDueFollowupsCount(res.followups.length);
    } catch {
      setDueFollowupsCount(0);
    }
  }, [isManager]);

  const refreshMobileData = useCallback(async () => {
    await Promise.all([
      loadBriefing(),
      loadStats(),
      loadNudges(),
      loadMyChecklist(),
      loadOpsStatus(),
      loadInventory(),
      loadOpenIncidents(),
      loadDueFollowups(),
    ]);
  }, [
    loadBriefing,
    loadStats,
    loadNudges,
    loadMyChecklist,
    loadOpsStatus,
    loadInventory,
    loadOpenIncidents,
    loadDueFollowups,
  ]);

  useEffect(() => {
    void refreshMobileData();
  }, [refreshMobileData]);

  useEventBusRefresh(
    [
      DATA_EVENTS.appointments,
      DATA_EVENTS.expenses,
      DATA_EVENTS.inventory,
      DATA_EVENTS.tasks,
      DATA_EVENTS.incidents,
      DATA_EVENTS.sops,
      DATA_EVENTS.nudges,
      DATA_EVENTS.followups,
    ],
    refreshMobileData,
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/api/briefing/generate", { type: "daily" });
      await loadBriefing();
      showToast("Briefing generated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleDumpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDumpLoading(true);
    setJarvisIntentResult(null);
    setJarvisPayoutProposal(null);
    try {
      const res = await api.post<ParseResult>("/api/jarvis", { rawText });
      setRawText("");
      if (res.type === "payout_proposal" && res.payoutProposal) {
        setJarvisPayoutProposal(res.payoutProposal);
        setJarvisHistoryRefreshKey((k) => k + 1);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        return;
      }
      if (res.type === "query_response" || res.type === "command_response") {
        setJarvisIntentResult({
          type: res.type,
          intent: res.intent === "COMMAND" ? "COMMAND" : "QUERY",
          confidence: res.confidence ?? 1,
          message: res.message ?? res.jarvisResponse,
          requiresApproval: false,
        });
        setJarvisHistoryRefreshKey((k) => k + 1);
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        return;
      }
      const count =
        res.committed.expenses +
        res.committed.incidents +
        res.committed.tasks +
        res.committed.strategicNotes;
      showToast(
        count > 0
          ? `JARVIS logged ${count} item${count === 1 ? "" : "s"}`
          : "Sent to JARVIS for review",
        "success",
      );
      emitJarvisCommitted(res.committed);
      if (res.suggestions.length > 0) {
        emitData(DATA_EVENTS.tasks);
      }
      setJarvisHistoryRefreshKey((k) => k + 1);
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Parse failed", "error");
    } finally {
      setDumpLoading(false);
    }
  };

  const toggleChecklistItem = async (item: MyChecklistItem) => {
    const sessionDate = todayISO();
    const prev = myChecklist;
    if (!prev) return;

    const optimisticItems = prev.items.map((row) =>
      row.itemId === item.itemId ? { ...row, completed: !row.completed } : row,
    );
    setMyChecklist({ ...prev, items: optimisticItems });

    try {
      if (item.completed) {
        await api.delete(`/api/sops/items/${item.itemId}/complete`, { sessionDate });
      } else {
        await api.post(`/api/sops/items/${item.itemId}/complete`, { sessionDate });
      }
      emitData(DATA_EVENTS.sops);
    } catch (err) {
      setMyChecklist(prev);
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const myCompletedCount = myChecklist?.items.filter((i) => i.completed).length ?? 0;
  const myTotalCount = myChecklist?.items.length ?? 0;
  const myAllDone = myTotalCount > 0 && myCompletedCount === myTotalCount;
  const opsCompleteCount = sopStatuses.filter((s) => s.pct === 100).length;
  const opsTotalCount = sopStatuses.length;

  if (!isMobile) {
    return <Navigate to="/dashboard" replace />;
  }

  const narrativePreview =
    briefing?.narrative && briefing.narrative.length > 280
      ? `${briefing.narrative.slice(0, 280).trim()}…`
      : briefing?.narrative ?? "";

  return (
    <div className="page mobile-home-page">
      <header className="mobile-home-header">
        <span className="wordmark-sm">FALLEN SPARROW</span>
        <h1>Today</h1>
      </header>

      {isManager && (
        <section className="mobile-home-section">
          <div className="mobile-section-head">
            <h2>Today&apos;s Briefing</h2>
            {isOwner && (
              <button
                type="button"
                className="btn-amber btn-sm"
                onClick={() => void handleGenerate()}
                disabled={generating}
              >
                {generating ? "Generating…" : "Generate Now"}
              </button>
            )}
          </div>
          {briefingLoading && <p className="text-muted">Loading briefing…</p>}
          {!briefingLoading && !briefing && (
            <p className="text-muted mobile-empty">
              No daily briefing yet.
              {isOwner ? " Tap Generate Now to create one." : ""}
            </p>
          )}
          {!briefingLoading && briefing && (
            <article className="briefing-card mobile-briefing-preview">
              <p className="text-muted mobile-briefing-meta">
                {briefing.generatedAt
                  ? new Date(briefing.generatedAt).toLocaleString()
                  : "Recently generated"}
              </p>
              <BriefingNarrative text={narrativePreview} className="briefing-bullets-compact" />
              <Link to="/briefing" className="mobile-link-amber">
                Read full briefing →
              </Link>
            </article>
          )}
        </section>
      )}

      <section className="mobile-home-section">
        <h2>Quick Stats</h2>
        {statsLoading && <p className="text-muted">Loading stats…</p>}
        {!statsLoading && (
          <div
            className={`mobile-stats-bar${isFrontDesk ? " mobile-stats-front-desk" : ""}${!canViewFinancials && !isFrontDesk ? " mobile-stats-two-col" : ""}`}
          >
            {isFrontDesk ? (
              <div className="mobile-stat">
                <span className="mobile-stat-value">
                  {daily?.appointmentCount ?? 0}
                </span>
                <span className="mobile-stat-label">Appointments Today</span>
              </div>
            ) : (
              <>
                {canViewFinancials && (
                  <div className="mobile-stat">
                    <span className="mobile-stat-value">
                      {formatCurrency(daily?.totalRevenue ?? 0)}
                    </span>
                    <span className="mobile-stat-label">Revenue Today</span>
                  </div>
                )}
                <div className="mobile-stat">
                  <span className="mobile-stat-value">
                    {daily?.appointmentCount ?? 0}
                  </span>
                  <span className="mobile-stat-label">Appts Today</span>
                </div>
                {canViewFinancials && (
                  <div className="mobile-stat">
                    <span className="mobile-stat-value">
                      {formatCurrency(monthly?.totalRevenue ?? 0)}
                    </span>
                    <span className="mobile-stat-label">MTD Revenue</span>
                  </div>
                )}
                {!canViewFinancials && (
                  <div className="mobile-stat">
                    <span className="mobile-stat-value">
                      {monthly?.appointmentCount ?? daily?.appointmentCount ?? 0}
                    </span>
                    <span className="mobile-stat-label">MTD Appts</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {myChecklist?.sop && (
        <section className="mobile-home-section mobile-my-checklist">
          <h2>
            Your Checklist · {myChecklist.sop.frequency?.replace(/_/g, " ") ?? "daily"} ·{" "}
            {myCompletedCount}/{myTotalCount} complete
          </h2>
          {checklistLoading && <p className="text-muted">Loading checklist...</p>}
          {!checklistLoading && myAllDone && (
            <div className="checklist-done-banner mobile-checklist-done">All done! ✓</div>
          )}
          {!checklistLoading && (
            <ul className="mobile-checklist-items">
              {myChecklist.items.map((item) => (
                <li key={item.itemId}>
                  <button
                    type="button"
                    className={`mobile-checklist-item${item.completed ? " completed" : ""}`}
                    onClick={() => void toggleChecklistItem(item)}
                  >
                    <span>{item.completed ? "✓" : "○"}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="mobile-home-section">
        <h2>JARVIS</h2>
        <form onSubmit={(e) => void handleDumpSubmit(e)} className="mobile-dump-form">
          <textarea
            ref={textareaRef}
            className="brain-dump-input mobile-dump-input"
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Log, ask a question, or run a command…"
            required
          />
          <button
            type="submit"
            className="btn-amber"
            disabled={dumpLoading || !rawText.trim()}
          >
            {dumpLoading ? "Sending…" : "Send"}
          </button>
        </form>
        {jarvisPayoutProposal ? (
          <JarvisPayoutProposal
            proposal={jarvisPayoutProposal}
            onConfirmed={(msg) => {
              setJarvisPayoutProposal(null);
              setJarvisIntentResult({
                type: "query_response",
                intent: "QUERY",
                confidence: 1,
                message: msg,
                requiresApproval: false,
              });
              emitData(DATA_EVENTS.appointments);
              showToast("Artist payout recorded", "success");
              setJarvisHistoryRefreshKey((k) => k + 1);
            }}
            onDismiss={() => setJarvisPayoutProposal(null)}
          />
        ) : null}
        {jarvisIntentResult && !jarvisPayoutProposal ? (
          <JarvisResponseRenderer result={jarvisIntentResult} />
        ) : null}
        <details className="mobile-jarvis-help jarvis-help-details">
          <summary className="jarvis-help-summary">
            <JarvisHelpSummary />
          </summary>
          <div className="jarvis-guide-body">
          <p className="text-muted">Type your message. Plain language is best.</p>
          <ul>
            <li>
              <strong>Log</strong>: expenses, incidents, tasks, inventory, notes. Review and approve before
              saving.
            </li>
            <li>
              <strong>Artist payout</strong> (owners/managers): e.g. &quot;Paid Carlos $5376 via Zelle&quot;.
              Confirm matched sessions with one button.
            </li>
            <li>
              <strong>Query</strong>: recaps, performance, expenses, SOPs, follow-ups due. Instant bullet answers, no review.
            </li>
            <li>
              <strong>Command</strong>: change PIN, add employee, deactivate. Runs right away with a
              confirmation (PINs are reset, not shown).
            </li>
          </ul>
          <p className="text-muted mobile-jarvis-help-examples">
            Log: &quot;Paid $60 for lunch yesterday.&quot; Query: &quot;How did we do last week?&quot; Query: &quot;What follow-ups are due?&quot; Command:
            &quot;Add Sarah to front desk.&quot;
          </p>
          </div>
        </details>
        <JarvisRequestHistory
          refreshKey={jarvisHistoryRefreshKey}
          detailsClassName="mobile-jarvis-history jarvis-history-details jarvis-help-details"
        />
        <Link to="/jarvis" className="mobile-link-amber mobile-jarvis-full-link">
          Full JARVIS →
        </Link>
      </section>

      {!isFrontDesk && nudgeCount > 0 && (
        <section className="mobile-home-section">
          <Link to="/customers?overdue=true" className="mobile-nudge-badge">
            <span className="mobile-nudge-count">{nudgeCount}</span>
            <span>
              client{nudgeCount === 1 ? "" : "s"} ready for a friendly reconnect
            </span>
            <span className="mobile-nudge-arrow">→</span>
          </Link>
        </section>
      )}

      {inventorySnap && inventorySnap.criticalCount > 0 && (
        <section className="mobile-home-section">
          <Link
            to="/inventory"
            className={`mobile-inventory-line${inventorySnap.outCount > 0 ? " alert-out" : " alert-low"}`}
          >
            <span>
              {inventorySnap.criticalCount} supply item
              {inventorySnap.criticalCount === 1 ? "" : "s"} need attention
            </span>
            <span className="mobile-nudge-arrow">→</span>
          </Link>
        </section>
      )}

      {isManager && dueFollowupsCount > 0 && (
        <section className="mobile-home-section">
          <Link to="/followups" className="mobile-nudge-badge mobile-followups-badge">
            <span className="mobile-nudge-count">{dueFollowupsCount}</span>
            <span>
              client follow-up{dueFollowupsCount === 1 ? "" : "s"} due
            </span>
            <span className="mobile-nudge-arrow">→</span>
          </Link>
        </section>
      )}

      {isManager && openIncidentsCount > 0 && (
        <section className="mobile-home-section">
          <Link to="/incidents" className="mobile-nudge-badge mobile-incidents-badge">
            <span className="mobile-nudge-count">{openIncidentsCount}</span>
            <span>
              open issue{openIncidentsCount === 1 ? "" : "s"}
            </span>
            <span className="mobile-nudge-arrow">→</span>
          </Link>
        </section>
      )}

      {isManager && sopStatuses.length > 0 && (
        <section className="mobile-home-section">
          <Link to="/operations" className="mobile-nudge-badge mobile-ops-badge">
            <span className="mobile-nudge-count">
              {opsCompleteCount}/{opsTotalCount}
            </span>
            <span>
              Checklists: {opsCompleteCount}/{opsTotalCount} complete today
            </span>
            <span className="mobile-nudge-arrow">→</span>
          </Link>
        </section>
      )}

      <footer className="mobile-home-footer">
        <Link to="/dashboard" className="mobile-link-amber">
          Full Dashboard →
        </Link>
      </footer>
    </div>
  );
}
