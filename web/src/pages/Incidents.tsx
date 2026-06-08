import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { EmptyState } from "@/components/EmptyState";
import { toDateInput } from "@/lib/format";
import { useToast } from "@/context/ToastContext";
import { formatDateOnly, formatDateTime, formatEnumLabel } from "@/lib/format";

type IncidentStatus = "open" | "in_progress" | "completed" | "all";

interface IncidentRow {
  id: string;
  incidentType: string;
  description: string;
  priority: string | null;
  status: "open" | "in_progress" | "completed";
  resolution: string | null;
  occurredDate: string | null;
  resolvedDate: string | null;
  createdAt: string;
}

const STATUS_FILTERS: { value: IncidentStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  { value: "completed", label: "Resolved" },
];

export function IncidentsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<IncidentStatus>("open");
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ incidents: IncidentRow[] }>(
        `/api/incidents?status=${status}`,
      );
      setIncidents(res.incidents);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load incidents", "error");
    } finally {
      setLoading(false);
    }
  }, [status, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventBusRefresh([DATA_EVENTS.incidents], load);

  const logExpenseForIncident = (description: string) => {
    const params = new URLSearchParams({
      expenseDesc: description,
      expenseDate: toDateInput(new Date()),
    });
    void navigate(`/pnl?${params.toString()}`);
  };

  const handleResolve = async (id: string) => {
    try {
      await api.patch(`/api/incidents/${id}/resolve`, {
        resolution: resolutionText.trim() || undefined,
      });
      showToast("Incident resolved", "success");
      emitData(DATA_EVENTS.incidents);
      setResolvingId(null);
      setResolutionText("");
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await api.patch(`/api/incidents/${id}/reopen`, {});
      showToast("Incident reopened", "success");
      emitData(DATA_EVENTS.incidents);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this incident?")) return;
    try {
      await api.delete(`/api/incidents/${id}`);
      showToast("Incident removed", "success");
      emitData(DATA_EVENTS.incidents);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="page activity-page">
      <div className="page-header-row">
        <h1>Incidents / Maintenance</h1>
        <Link to="/jarvis" className="btn-dark">
          Log via JARVIS
        </Link>
      </div>
      <p className="text-muted activity-page-intro">
        Mechanical and functional shop issues: HVAC, plumbing, equipment, and facility problems.
      </p>

      <div className="activity-filters">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`activity-filter-btn${status === f.value ? " active" : ""}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted">Loading...</p>}
      {!loading && incidents.length === 0 && (
        <EmptyState
          icon="🔧"
          title="No incidents in this view"
          description="JARVIS logs equipment and facility issues automatically when you mention them in a brain dump."
          ctaLabel="Log via JARVIS"
          ctaTo="/jarvis"
        />
      )}
      {!loading && incidents.length > 0 && (
        <ul className="activity-list">
          {incidents.map((inc) => (
            <li
              key={inc.id}
              className={`activity-card${inc.status === "completed" ? " activity-card-done" : ""}`}
            >
              <div className="activity-card-head">
                <span className="activity-badge">{formatEnumLabel(inc.incidentType)}</span>
                {inc.priority && inc.priority !== "normal" && (
                  <span className="activity-badge activity-badge-priority">
                    {formatEnumLabel(inc.priority)}
                  </span>
                )}
                <span className={`activity-status activity-status-${inc.status}`}>
                  {inc.status === "completed" ? "Resolved" : formatEnumLabel(inc.status)}
                </span>
              </div>
              <p className="activity-card-title">{inc.description}</p>
              <div className="activity-card-meta text-muted">
                {inc.occurredDate && <span>Occurred {formatDateOnly(inc.occurredDate)}</span>}
                <span>Logged {formatDateTime(inc.createdAt)}</span>
              </div>
              {inc.resolution && (
                <p className="activity-resolution text-muted">Resolution: {inc.resolution}</p>
              )}
              {resolvingId === inc.id ? (
                <div className="activity-resolve-form">
                  <textarea
                    rows={2}
                    className="jrv-input"
                    placeholder="Resolution notes (optional)"
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                  />
                  <div className="activity-card-actions">
                    <button
                      type="button"
                      className="btn-amber btn-sm"
                      onClick={() => void handleResolve(inc.id)}
                    >
                      Confirm resolve
                    </button>
                    <button
                      type="button"
                      className="btn-dark btn-sm"
                      onClick={() => {
                        setResolvingId(null);
                        setResolutionText("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="activity-card-actions">
                  {inc.status !== "completed" && (
                    <>
                      <button
                        type="button"
                        className="btn-amber btn-sm"
                        onClick={() => setResolvingId(inc.id)}
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        className="btn-dark btn-sm"
                        onClick={() => logExpenseForIncident(inc.description)}
                      >
                        Log expense for repair
                      </button>
                    </>
                  )}
                  {inc.status === "completed" && (
                    <button
                      type="button"
                      className="btn-dark btn-sm"
                      onClick={() => void handleReopen(inc.id)}
                    >
                      Reopen
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-dark btn-sm"
                    onClick={() => void handleDelete(inc.id)}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
