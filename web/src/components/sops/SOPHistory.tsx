import { useCallback, useEffect, useState } from "react";
import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { api } from "@/lib/api";

interface HistoryEntry {
  date: string;
  employee: string;
  sopName: string;
  completedCount: number;
  totalCount: number;
  status: "complete" | "partial";
  completedAt: string | null;
  missedItems: string[];
}

interface SOPHistoryProps {
  role: TeamMemberRole;
}

export function SOPHistory({ role }: SOPHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [daysBack, setDaysBack] = useState(7);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ history: HistoryEntry[] }>(
        `/api/sop-history/by-role/${role}?daysBack=${daysBack}`,
      );
      setHistory(res.history);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [role, daysBack]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="sop-history">
      <div className="sop-history-head">
        <h3>Completion history</h3>
        <select
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value))}
          aria-label="History range"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {loading && <p className="text-muted sop-history-empty">Loading history...</p>}

      {!loading && history.length === 0 && (
        <p className="text-muted sop-history-empty">No completions yet</p>
      )}

      {!loading && history.length > 0 && (
        <div className="sop-history-table-wrap">
          <table className="sop-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>SOP</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => (
                <tr key={`${entry.date}-${entry.employee}-${entry.sopName}`}>
                  <td>{new Date(`${entry.date}T12:00:00`).toLocaleDateString()}</td>
                  <td>{entry.employee}</td>
                  <td>{entry.sopName}</td>
                  <td>
                    {entry.status === "complete" ? (
                      <span className="sop-history-complete">
                        {entry.completedCount}/{entry.totalCount}
                      </span>
                    ) : (
                      <span className="sop-history-partial" title={entry.missedItems.join(", ")}>
                        {entry.completedCount}/{entry.totalCount}
                        {entry.missedItems.length > 0
                          ? ` (missed: ${entry.missedItems.slice(0, 2).join(", ")}${entry.missedItems.length > 2 ? "..." : ""})`
                          : ""}
                      </span>
                    )}
                  </td>
                  <td>
                    {entry.completedAt
                      ? new Date(entry.completedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "n/a"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
