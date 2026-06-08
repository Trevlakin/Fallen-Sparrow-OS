import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/context/ToastContext";
import { formatDateOnly, formatDateTime, formatEnumLabel } from "@/lib/format";

type TaskStatus = "open" | "in_progress" | "completed" | "all";

interface TaskRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "completed";
  priority: string | null;
  dueDate: string | null;
  completedDate: string | null;
  createdAt: string;
}

const STATUS_FILTERS: { value: TaskStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
];

export function TasksPage() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<TaskStatus>("open");
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ tasks: TaskRow[] }>(`/api/tasks?status=${status}`);
      setTasks(res.tasks);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  }, [status, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventBusRefresh([DATA_EVENTS.tasks], load);

  const handleComplete = async (id: string) => {
    try {
      await api.patch(`/api/tasks/${id}/complete`, {});
      showToast("Task completed", "success");
      emitData(DATA_EVENTS.tasks);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await api.patch(`/api/tasks/${id}/reopen`, {});
      showToast("Task reopened", "success");
      emitData(DATA_EVENTS.tasks);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this task?")) return;
    try {
      await api.delete(`/api/tasks/${id}`);
      showToast("Task removed", "success");
      emitData(DATA_EVENTS.tasks);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="page activity-page">
      <div className="page-header-row">
        <h1>Tasks</h1>
        <Link to="/jarvis" className="btn-dark">
          Log via JARVIS
        </Link>
      </div>
      <p className="text-muted activity-page-intro">
        Follow-ups, ordering, and admin to-dos. Shop breakdowns (AC, plumbing, equipment) belong under Incidents / Maintenance.
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
      {!loading && tasks.length === 0 && (
        <EmptyState
          icon="✓"
          title="No tasks in this view"
          description="Follow-ups and admin to-dos appear here when you log them through JARVIS."
          ctaLabel="Log via JARVIS"
          ctaTo="/jarvis"
        />
      )}
      {!loading && tasks.length > 0 && (
        <ul className="activity-list">
          {tasks.map((t) => (
            <li key={t.id} className={`activity-card${t.status === "completed" ? " activity-card-done" : ""}`}>
              <div className="activity-card-head">
                <span className="activity-badge">{formatEnumLabel(t.type)}</span>
                {t.priority && t.priority !== "normal" && (
                  <span className="activity-badge activity-badge-priority">
                    {formatEnumLabel(t.priority)}
                  </span>
                )}
                <span className={`activity-status activity-status-${t.status}`}>
                  {formatEnumLabel(t.status)}
                </span>
              </div>
              <p className="activity-card-title">{t.description ?? t.title}</p>
              <div className="activity-card-meta text-muted">
                {t.dueDate && <span>Due {formatDateOnly(t.dueDate)}</span>}
                <span>Logged {formatDateTime(t.createdAt)}</span>
              </div>
              <div className="activity-card-actions">
                {t.status !== "completed" && (
                  <button type="button" className="btn-amber btn-sm" onClick={() => void handleComplete(t.id)}>
                    Complete
                  </button>
                )}
                {t.status === "completed" && (
                  <button type="button" className="btn-dark btn-sm" onClick={() => void handleReopen(t.id)}>
                    Reopen
                  </button>
                )}
                <button type="button" className="btn-dark btn-sm" onClick={() => void handleDelete(t.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
