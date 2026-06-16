import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { ContinuityDrawer } from "@/components/ContinuityDrawer";
import { EmptyState } from "@/components/EmptyState";
import { KpiConfigModal } from "@/components/KpiConfigModal";
import {
  useAuth,
  useCanViewFinancials,
  useIsFrontDesk,
  useIsManager,
  useIsOwner,
} from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useTour } from "@/hooks/useTour";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { api } from "@/lib/api";
import { DATA_EVENTS } from "@/lib/eventBus";
import { formatCurrency, formatCurrencyDetailed, formatPercent, formatServiceType } from "@/lib/format";
import { loadKpiConfig, type KpiConfig } from "@/lib/kpiConfig";
import {
  buildTimelineRange,
  isYtdOrFullYear,
  type PeriodKey,
  type TimelineRange,
} from "@/lib/timeline";
import { checklistBorderClass } from "@/lib/checklistApi";

interface WeeklySummary {
  totalRevenue: number;
  appointmentCount: number;
  byArtist: Record<string, { artistName: string; total: { revenue: number; count: number } }>;
}

interface YtdSummary {
  totalRevenue: number;
  totalShopProfit: number;
  appointmentCount: number;
  avgBookingValue: number;
  projectedAnnualRevenue: number;
  priorYearRevenue: number;
  growthRatePct: number;
  daysSinceJanFirst: number;
}

interface PnlSummary {
  totalRevenue: number;
  totalPayroll: number;
  totalFixedExpenses: number;
  netProfit: number;
  marginPercent: number;
  byService: Record<
    string,
    {
      revenue: number;
      profit: number;
      margin: number;
      volumePercent: number;
      appointmentCount: number;
    }
  >;
}

interface ArtistPerf {
  artistId: string;
  artistName: string;
  totalRevenue: number;
  appointmentCount: number;
  avgBookingValue: number;
}

interface CustomerSpend {
  customerId: string;
  customerName: string | null;
  totalSpend: number;
  appointmentCount: number;
  avgSpend: number;
}

interface NudgeCandidate {
  customerId: string;
  name: string;
  daysSinceLastAppointment: number;
  preferredArtistName: string | null;
  suggestedMessage: string;
}

interface SopStatusRow {
  sopId: string;
  sopTitle: string;
  roleLabel: string;
  totalItems: number;
  completedToday: number;
  pct: number;
}

interface InventorySnapshotWidget {
  criticalCount: number;
  outItems: { name: string }[];
  lowItems: { name: string; currentStock: number; unit: string }[];
}

const PERIOD_OPTIONS: Array<{ value: PeriodKey; label: string }> = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "ytd", label: "YTD" },
  { value: "full_year", label: "Full Year" },
  { value: "custom", label: "Custom Range" },
];

function KpiCard({
  label,
  value,
  subtext,
  className = "",
  hidden,
}: {
  label: string;
  value: string;
  subtext?: ReactNode;
  className?: string;
  hidden?: boolean;
}) {
  if (hidden) return null;
  return (
    <div className={`kpi-card ${className}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {subtext && <div className="kpi-subtext">{subtext}</div>}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const canViewFinancials = useCanViewFinancials();
  const isFrontDesk = useIsFrontDesk();
  const isManager = useIsManager();
  const { showToast } = useToast();
  const currentYear = new Date().getUTCFullYear();

  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState<PeriodKey>("ytd");
  const [customFrom, setCustomFrom] = useState(`${currentYear}-01-01`);
  const [customTo, setCustomTo] = useState(`${currentYear}-12-31`);
  const [kpiConfig, setKpiConfig] = useState<KpiConfig>(() => loadKpiConfig());
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const isOwner = useIsOwner();
  const showDevReset = import.meta.env.DEV && isOwner;
  const [drawerCustomerId, setDrawerCustomerId] = useState<string | null>(null);

  const [weekly, setWeekly] = useState<WeeklySummary | null>(null);
  const [ytd, setYtd] = useState<YtdSummary | null>(null);
  const [pnl, setPnl] = useState<PnlSummary | null>(null);
  const [artists, setArtists] = useState<ArtistPerf[]>([]);
  const [clients, setClients] = useState<CustomerSpend[]>([]);
  const [nudgeCandidates, setNudgeCandidates] = useState<NudgeCandidate[]>([]);
  const [sopStatuses, setSopStatuses] = useState<SopStatusRow[]>([]);
  const [inventorySnap, setInventorySnap] = useState<InventorySnapshotWidget | null>(null);
  const [hasBriefing, setHasBriefing] = useState(false);
  const [kpiGuidanceDismissed, setKpiGuidanceDismissed] = useState(
    () => localStorage.getItem("fs_kpi_guidance_dismissed") === "true",
  );
  const [setupDone, setSetupDone] = useState(
    () => localStorage.getItem("fs_setup_done") === "true",
  );
  const [loading, setLoading] = useState(true);
  const { shouldShow, startTour } = useTour(!isFrontDesk);

  const timeline: TimelineRange = useMemo(
    () => buildTimelineRange(year, period, customFrom, customTo),
    [year, period, customFrom, customTo],
  );

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const loadSopStatus = useCallback(async () => {
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

  const loadInventorySnapshot = useCallback(async () => {
    try {
      const snap = await api.get<InventorySnapshotWidget>("/api/inventory/snapshot");
      setInventorySnap(snap);
    } catch {
      setInventorySnap(null);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const useYtd = isYtdOrFullYear(period);
      const fetches: Promise<void>[] = [];

      if (isFrontDesk) {
        fetches.push(
          api
            .get<{ candidates: NudgeCandidate[] }>("/api/nudges/candidates")
            .then((res) => setNudgeCandidates(res.candidates)),
        );
      } else if (canViewFinancials) {
        if (useYtd) {
          fetches.push(
            api
              .get<YtdSummary>(`/api/metrics/ytd?year=${year}`)
              .then((data) => {
                setYtd(data);
                setWeekly(null);
              }),
          );
        } else {
          fetches.push(
            api
              .get<WeeklySummary>(
                `/api/metrics/weekly?start=${timeline.from}&end=${timeline.to}`,
              )
              .then((data) => {
                setWeekly(data);
                setYtd(null);
              }),
          );
        }

        fetches.push(
          api
            .get<PnlSummary>(
              `/api/pnl/range?start=${timeline.from}&end=${timeline.to}`,
            )
            .then(setPnl),
          api
            .get<{ customers: CustomerSpend[] }>("/api/customers/by-spend?limit=10")
            .then((res) => setClients(res.customers)),
        );
      } else {
        setYtd(null);
        setPnl(null);
        setClients([]);
        fetches.push(
          api
            .get<WeeklySummary>(
              `/api/metrics/weekly?start=${timeline.from}&end=${timeline.to}`,
            )
            .then(setWeekly),
        );
      }

      if (!isFrontDesk) {
        fetches.push(
          api
            .get<{ artists: ArtistPerf[] }>(
              `/api/artists/performance?from=${timeline.from}&to=${timeline.to}`,
            )
            .then((res) => {
              let list = res.artists;
              if (user?.role === "ARTIST") {
                list = list.filter((a) => a.artistId === user.id);
              }
              setArtists(list);
            }),
        );
      }

      if (isManager) {
        fetches.push(
          api
            .get<{ id: string; narrative: string | null }>("/api/briefing/latest?type=daily")
            .then((res) => setHasBriefing(Boolean(res.narrative)))
            .catch(() => setHasBriefing(false)),
        );
      }

      await Promise.all(fetches);
      await loadSopStatus();
      await loadInventorySnapshot();
    } finally {
      setLoading(false);
    }
  }, [canViewFinancials, isFrontDesk, isManager, loadInventorySnapshot, loadSopStatus, period, timeline.from, timeline.to, year, user]);

  const handleResetDashboard = async () => {
    if (
      !window.confirm(
        "Reset all dashboard metrics to zero? This deletes expenses, appointments, JARVIS logs, and related data. Users and settings are kept.",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      await api.post("/api/dev/reset-dashboard", {});
      showToast("Dashboard data cleared", "success");
      await loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reset failed", "error");
    } finally {
      setResetting(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEventBusRefresh(
    [
      DATA_EVENTS.appointments,
      DATA_EVENTS.expenses,
      DATA_EVENTS.inventory,
      DATA_EVENTS.sops,
      DATA_EVENTS.nudges,
    ],
    loadData,
  );

  useEffect(() => {
    if (!isManager) return;
    const interval = window.setInterval(() => {
      void loadSopStatus();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [isManager, loadSopStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadInventorySnapshot();
    }, 10 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, [loadInventorySnapshot]);

  useEffect(() => {
    if (shouldShow && !loading) {
      startTour();
    }
  }, [shouldShow, loading, startTour]);

  const totalRevenue = ytd?.totalRevenue ?? weekly?.totalRevenue ?? 0;
  const appointmentCount = ytd?.appointmentCount ?? weekly?.appointmentCount ?? 0;
  const avgBooking =
    ytd?.avgBookingValue ??
    (appointmentCount > 0 ? totalRevenue / appointmentCount : 0);
  const shopMarginPct = pnl?.marginPercent ?? 0;
  const growthRate = ytd?.growthRatePct ?? 0;
  const growthPositive = growthRate >= 0;

  const serviceLines = useMemo(() => {
    if (!pnl?.byService) return [];
    return Object.entries(pnl.byService)
      .map(([type, data]) => ({
        type,
        label: formatServiceType(type),
        revenue: data.revenue,
        margin: data.margin,
        count: data.appointmentCount ?? 0,
        avg: data.revenue > 0 && appointmentCount > 0 ? data.revenue / Math.max(1, appointmentCount) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [pnl, appointmentCount]);

  const sortedArtists = [...artists].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const allSopsComplete =
    sopStatuses.length > 0 && sopStatuses.every((s) => s.pct === 100);
  const showKpiGuidance =
    !kpiGuidanceDismissed &&
    canViewFinancials &&
    !loading &&
    totalRevenue === 0 &&
    appointmentCount === 0;
  const hasAppointments = appointmentCount > 0;
  const showSetupTracker =
    !setupDone && !hasAppointments && canViewFinancials && isManager && !isFrontDesk;

  const dismissKpiGuidance = () => {
    localStorage.setItem("fs_kpi_guidance_dismissed", "true");
    setKpiGuidanceDismissed(true);
  };

  useEffect(() => {
    if (setupDone) return;
    if (appointmentCount > 0) {
      localStorage.setItem("fs_setup_done", "true");
      setSetupDone(true);
      return;
    }
    if (hasBriefing) {
      localStorage.setItem("fs_setup_done", "true");
      setSetupDone(true);
    }
  }, [appointmentCount, hasBriefing, setupDone]);

  const handleExportPdf = async () => {
    setExporting(true);
    const el = document.getElementById("dashboard-content");
    if (!el) {
      setExporting(false);
      return;
    }
    try {
      await html2pdf()
        .set({
          margin: 10,
          filename: `fallen-sparrow-${timeline.from}-to-${timeline.to}-report.pdf`,
          html2canvas: { scale: 2, backgroundColor: "#0A0A0A" },
        })
        .from(el)
        .save();
      showToast("PDF exported", "success");
    } catch {
      showToast("PDF export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  if (isFrontDesk) {
    return (
      <div className="dashboard-page front-desk-dashboard">
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <span className="wordmark-sm">FALLEN SPARROW</span>
            <h1>Nudge Candidates</h1>
            <span className="live-badge">
              <span className="live-dot" /> Clients ready for a friendly reconnect
            </span>
          </div>
        </header>
        {loading && <p className="text-muted">Loading...</p>}
        {!loading && (
          <section className="intel-panel">
            {!loading && nudgeCandidates.length > 0 && (
              <div className="intel-panel-head" style={{ marginBottom: "0.5rem" }}>
                <Link to="/customers?overdue=true" className="mobile-link-amber">
                  View all nudge candidates →
                </Link>
              </div>
            )}
            <ul className="intel-list">
              {nudgeCandidates.length === 0 && (
                <EmptyState
                  icon="👋"
                  title="No nudge candidates right now"
                  description="Clients appear here when they are overdue for a friendly reconnect based on their visit history."
                  ctaLabel="View all clients"
                  ctaTo="/customers"
                />
              )}
              {nudgeCandidates.map((c) => (
                <li key={c.customerId}>
                  <div className="intel-row-main">
                    <button
                      type="button"
                      className="client-link"
                      onClick={() => setDrawerCustomerId(c.customerId)}
                    >
                      {c.name}
                    </button>
                    <span className="overdue-badge">Overdue</span>
                  </div>
                  <div className="intel-row-sub">
                    <span>{c.daysSinceLastAppointment} days since last visit</span>
                    <span>{c.preferredArtistName ?? "Any artist"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        <ContinuityDrawer
          customerId={drawerCustomerId}
          onClose={() => setDrawerCustomerId(null)}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <header className={`dashboard-topbar ${exporting ? "exporting" : ""}`}>
        <div className="topbar-left">
          <span className="wordmark-sm">FALLEN SPARROW</span>
          <h1>Business Analytics</h1>
          <span className="live-badge">
            <span className="live-dot" /> Live Data · {timeline.label}
          </span>
        </div>
        <div className="topbar-actions">
          {canViewFinancials && (
            <>
              {showDevReset && (
                <button
                  type="button"
                  className="btn-dark btn-dev-reset"
                  disabled={resetting}
                  onClick={() => void handleResetDashboard()}
                >
                  {resetting ? "Resetting…" : "Reset dashboard"}
                </button>
              )}
              <button
                type="button"
                className="btn-dark"
                data-tour="configure-kpis"
                onClick={() => setShowKpiModal(true)}
              >
                Configure KPIs
              </button>
              <button
                type="button"
                className="btn-amber"
                onClick={() => void handleExportPdf()}
                disabled={exporting}
              >
                Export PDF
              </button>
            </>
          )}
        </div>
      </header>

      <div className="timeline-selector" data-tour="timeline-selector">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={period} onChange={(e) => setPeriod(e.target.value as PeriodKey)}>
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {period === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </>
        )}
        <p className="timeline-range-label">
          {timeline.from} to {timeline.to}
        </p>
      </div>

      <div id="dashboard-content" className="dashboard-content">
        {loading && <p className="text-muted">Loading metrics...</p>}

        {!loading && showSetupTracker && (
          <section className="setup-tracker">
            <h3>GETTING STARTED: 3 steps to your first briefing</h3>
            <ol className="setup-tracker-steps">
              <li className="setup-tracker-step done">
                <span>✓</span>
                <span>System configured</span>
              </li>
              <li className={`setup-tracker-step${hasAppointments ? " done" : ""}`}>
                <span>{hasAppointments ? "✓" : "○"}</span>
                <span>
                  Import your first appointments. Upload a Porter CSV or test file to see your dashboard.
                </span>
                {!hasAppointments && (
                  <Link to="/pnl">Import data →</Link>
                )}
              </li>
              <li className={`setup-tracker-step${hasBriefing ? " done" : ""}`}>
                <span>{hasBriefing ? "✓" : "○"}</span>
                <span>Generate your first briefing on the Briefing page.</span>
                {!hasBriefing && <Link to="/briefing">Go to Briefing →</Link>}
              </li>
            </ol>
          </section>
        )}

        {showKpiGuidance && (
          <div className="dashboard-guidance-banner">
            <span>
              Your dashboard updates automatically when Porter data flows in. To see numbers now, go to P&amp;L and upload a CSV.
            </span>
            <Link to="/pnl">Go to P&amp;L</Link>
            <button type="button" className="btn-dark btn-sm" onClick={dismissKpiGuidance}>
              Dismiss
            </button>
          </div>
        )}

        <div className="kpi-row" data-tour="kpi-cards">
          <KpiCard
            hidden={!kpiConfig.totalRevenue || !canViewFinancials}
            label="Total Revenue"
            value={formatCurrency(totalRevenue)}
          />
          <KpiCard
            hidden={!kpiConfig.totalAppointments}
            label="Total Appointments"
            value={String(appointmentCount)}
          />
          <KpiCard
            hidden={!kpiConfig.avgBookingValue}
            label="Avg Booking Value"
            value={formatCurrency(avgBooking)}
          />
          <KpiCard
            hidden={!kpiConfig.shopMargin || !canViewFinancials}
            label="Shop Margin %"
            value={formatPercent(shopMarginPct)}
          />
        </div>

        {canViewFinancials && (
          <div className="kpi-row kpi-row-secondary">
            <KpiCard
              hidden={!kpiConfig.growthRate}
              label="Revenue Growth Rate"
              value={`${growthPositive ? "▲" : "▼"} ${formatPercent(Math.abs(growthRate))}`}
              subtext={`vs ${year - 1}`}
              className={growthPositive ? "growth-positive" : "growth-negative"}
            />
            <KpiCard
              hidden={!kpiConfig.ytdRevenue}
              label="YTD Revenue"
              value={formatCurrency(ytd?.totalRevenue ?? totalRevenue)}
              subtext={`Year to date · ${year}`}
            />
            <KpiCard
              hidden={!kpiConfig.annualProjection}
              label="Projected Annual Revenue"
              value={formatCurrency(ytd?.projectedAnnualRevenue ?? 0)}
              subtext={
                ytd
                  ? `Based on YTD (${formatCurrency(ytd.totalRevenue)}) ÷ ${ytd.daysSinceJanFirst} days × 365`
                  : "Based on current period pace"
              }
            />
            <KpiCard
              hidden={!kpiConfig.profitAfterPayouts}
              label="Profit After Artist Payouts"
              value={formatCurrency(pnl?.netProfit ?? ytd?.totalShopProfit ?? 0)}
              className={`profit-card ${(pnl?.netProfit ?? 0) < 0 ? "negative" : ""}`}
              subtext={
                pnl ? (
                  <div className="profit-breakdown">
                    <span className="badge-green">● Payouts Included</span>
                    <div>Contribution Margin: {formatPercent(pnl.marginPercent)}</div>
                    <div className="text-green">
                      Artist Payouts: {formatCurrency(pnl.totalPayroll)}
                    </div>
                    <div className="text-green">
                      Expenses: {formatCurrency(pnl.totalFixedExpenses)}
                    </div>
                    <p className="profit-hint">
                      · Contribution Margin = share of revenue left after payouts &amp; expenses
                      <br />· Artist Payouts = commissions per appointment
                      <br />· Expenses = supplies, maintenance, and logged costs
                    </p>
                  </div>
                ) : undefined
              }
            />
          </div>
        )}

        <div className="intelligence-panels">
          {kpiConfig.servicePerformance && canViewFinancials && (
            <section className="intel-panel">
              <h3>Service Performance</h3>
              <p className="panel-sub">All services by revenue:</p>
              {serviceLines.length === 0 ? (
                <EmptyState
                  icon="📊"
                  title="No service data yet"
                  description="Service breakdown appears once appointment data is imported."
                  ctaLabel="Import appointments"
                  ctaTo="/pnl"
                />
              ) : (
              <ul className="intel-list scrollable">
                {serviceLines.map((s) => (
                  <li key={s.type}>
                    <div className="intel-row-main">
                      <span>{s.label}</span>
                      <span className="value-amber">{formatCurrencyDetailed(s.revenue)}</span>
                    </div>
                    <div className="intel-row-sub">
                      <span>
                        {s.count} appointments · Avg {formatCurrency(s.avg)}
                      </span>
                      <span>{formatPercent(s.margin)} margin</span>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </section>
          )}

          {kpiConfig.artistRankings && (
            <section className="intel-panel" data-tour="artist-rankings">
              <h3>Artist Rankings</h3>
              <p className="panel-sub">Artist performance rankings:</p>
              {sortedArtists.length === 0 ? (
                <EmptyState
                  icon="🎨"
                  title="No artist rankings yet"
                  description="Artist rankings appear once appointment data is imported."
                  ctaLabel="Import appointments"
                  ctaTo="/pnl"
                />
              ) : (
              <ol className="intel-list ranked">
                {sortedArtists.map((artist, idx) => (
                  <li key={artist.artistId}>
                    <span className="rank-badge">{idx + 1}</span>
                    <div className="intel-row-main">
                      <Link to="/artists" className="client-link">
                        {artist.artistName}
                      </Link>
                      <span className="value-amber">
                        {canViewFinancials ? (
                          formatCurrencyDetailed(artist.totalRevenue)
                        ) : (
                          `${artist.appointmentCount} appts`
                        )}
                      </span>
                    </div>
                    <div className="intel-row-sub">
                      <span>
                        {artist.appointmentCount} appointments · Avg{" "}
                        {formatCurrency(artist.avgBookingValue)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              )}
            </section>
          )}

          {kpiConfig.clientIntelligence && canViewFinancials && (
            <section className="intel-panel" data-tour="client-intelligence">
              <h3>Client Intelligence</h3>
              <p className="panel-sub">All clients by spend:</p>
              <p className="panel-sub-italic">
                Click any client name to view their continuity profile
              </p>
              {clients.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No client data yet"
                  description="Client intelligence appears once Porter appointments are synced or imported."
                  ctaLabel="Import data"
                  ctaTo="/pnl"
                />
              ) : (
              <ul className="intel-list">
                {clients.map((c) => (
                  <li key={c.customerId}>
                    <div className="intel-row-main">
                      <button
                        type="button"
                        className="client-link"
                        onClick={() => setDrawerCustomerId(c.customerId)}
                      >
                        {c.customerName ?? "Unknown Client"}
                      </button>
                      <span className="value-amber">
                        {formatCurrencyDetailed(c.totalSpend)}
                      </span>
                    </div>
                    <div className="intel-row-sub">
                      <span>
                        {c.appointmentCount} appointments · Avg {formatCurrency(c.avgSpend)}
                      </span>
                      <span>{c.appointmentCount} visits</span>
                    </div>
                  </li>
                ))}
              </ul>
              )}
            </section>
          )}
        </div>

        {isManager && sopStatuses.length > 0 && (
          <section className="intel-panel operations-widget" data-tour="operations-widget">
            <div className="intel-panel-head">
              <h3>Today&apos;s Operations</h3>
              <Link to="/operations" className="mobile-link-amber">
                View details →
              </Link>
            </div>
            {allSopsComplete ? (
              <Link to="/operations" className="ops-widget-row ops-all-complete">
                ✓ All checklists complete today
              </Link>
            ) : (
              <ul className="ops-widget-list">
                {sopStatuses.map((row) => {
                  const border = checklistBorderClass(row.pct, row.completedToday);
                  return (
                    <li key={row.sopId}>
                      <Link
                        to="/operations"
                        className={`ops-widget-row sop-border-${border}`}
                      >
                        <span className="role-badge">{row.roleLabel}</span>
                        <span className="ops-widget-title">{row.sopTitle}</span>
                        <div className="sop-progress-track">
                          <div
                            className="sop-progress-fill"
                            style={{ width: `${row.pct}%` }}
                          />
                        </div>
                        <span className="ops-widget-count">
                          {row.completedToday}/{row.totalItems}
                        </span>
                        <span className="ops-widget-pct">{row.pct}%</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        <section className="intel-panel inventory-widget">
          <h3>Inventory</h3>
          {!inventorySnap && <p className="text-muted">Loading inventory status...</p>}
          {inventorySnap && inventorySnap.criticalCount === 0 && (
            <p className="inventory-widget-stocked">● All supplies stocked</p>
          )}
          {inventorySnap && inventorySnap.criticalCount > 0 && (
            <>
              <div className="inventory-widget-header">INVENTORY ALERTS</div>
              {inventorySnap.outItems.map((item) => (
                <p key={item.name} className="inventory-widget-alert inventory-widget-out">
                  ● {item.name} - OUT
                </p>
              ))}
              {inventorySnap.lowItems.map((item) => (
                <p
                  key={item.name}
                  className="inventory-widget-alert inventory-widget-low"
                >
                  ● {item.name} - {item.currentStock} {item.unit}s left
                </p>
              ))}
              <Link to="/inventory" className="inventory-widget-link">
                Manage inventory →
              </Link>
            </>
          )}
        </section>
      </div>

      {showKpiModal && (
        <KpiConfigModal
          config={kpiConfig}
          onApply={setKpiConfig}
          onClose={() => setShowKpiModal(false)}
        />
      )}

      <ContinuityDrawer
        customerId={drawerCustomerId}
        onClose={() => setDrawerCustomerId(null)}
      />
    </div>
  );
}
