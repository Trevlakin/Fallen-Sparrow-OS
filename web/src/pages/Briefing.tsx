import { useCallback, useEffect, useState } from "react";
import { BriefingNarrative } from "@/components/BriefingNarrative";
import { api } from "@/lib/api";

type BriefingPeriod = "24h" | "7d" | "30d";

interface OnDemandBriefing {
  narrative: string;
  generatedAt: string;
  period: BriefingPeriod;
  hasData: boolean;
  cached: boolean;
}

const PERIOD_TABS: { id: BriefingPeriod; label: string }[] = [
  { id: "24h", label: "Last 24 hours" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

function formatLastUpdated(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return isToday ? `Today at ${time}` : date.toLocaleString();
}

export function BriefingPage() {
  const [period, setPeriod] = useState<BriefingPeriod>("24h");
  const [briefing, setBriefing] = useState<OnDemandBriefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBriefing = useCallback(async (selectedPeriod: BriefingPeriod, refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.post<OnDemandBriefing>("/api/briefing/generate", {
        period: selectedPeriod,
        refresh,
      });
      setBriefing(res);
    } catch {
      setBriefing(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBriefing(period);
  }, [period, loadBriefing]);

  const handleRefresh = () => {
    void loadBriefing(period, true);
  };

  const showEmpty =
    !loading &&
    !refreshing &&
    (!briefing || !briefing.hasData || !briefing.narrative.trim());

  return (
    <div className="page briefing-page">
      <div className="page-header-row briefing-header">
        <h1>ORACLE BRIEFING</h1>
        <button
          type="button"
          className="btn-ghost briefing-refresh-btn"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh briefing"
        >
          Refresh ↺
        </button>
      </div>

      {briefing?.generatedAt && !loading && (
        <p className="briefing-last-updated text-muted">
          Last updated: {formatLastUpdated(briefing.generatedAt)}
        </p>
      )}

      <div className="briefing-period-tabs" role="tablist" aria-label="Briefing period">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={period === tab.id}
            className={`briefing-period-tab${period === tab.id ? " active" : ""}`}
            onClick={() => setPeriod(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(loading || refreshing) && (
        <div className="briefing-loading" aria-live="polite">
          <span className="briefing-loading-pulse">Oracle is thinking...</span>
        </div>
      )}

      {showEmpty && (
        <div className="briefing-empty-state">
          <p>
            No data available for this period. Import sales data or log expenses to see your
            first briefing.
          </p>
        </div>
      )}

      {!loading && !refreshing && briefing?.narrative && briefing.hasData && (
        <article className="briefing-card">
          <BriefingNarrative text={briefing.narrative} />
        </article>
      )}
    </div>
  );
}
