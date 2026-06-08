import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { DATA_EVENTS } from "@/lib/eventBus";
import { useToast } from "@/context/ToastContext";

type PnlImportType = "expenses" | "sales";

interface PnlImportHistoryItem {
  id: string;
  importType: PnlImportType;
  fileName: string;
  rowCount: number;
  skippedCount: number;
  summaryStats: { errorCount?: number } | null;
  createdAt: string;
}

function formatImportTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function importTypeLabel(type: PnlImportType): string {
  return type === "expenses" ? "Expenses" : "Sales";
}

function importTypeBadgeClass(type: PnlImportType): string {
  return type === "expenses"
    ? "pnl-import-type pnl-import-type-expenses"
    : "pnl-import-type pnl-import-type-sales";
}

export function PnlImportHistory() {
  const { showToast } = useToast();
  const [items, setItems] = useState<PnlImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ imports: PnlImportHistoryItem[] }>("/api/pnl/imports");
      setItems(res.imports);
    } catch (err) {
      setItems([]);
      setLoadError(
        err instanceof Error ? err.message : "Could not load import history",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEventBusRefresh([DATA_EVENTS.expenses, DATA_EVENTS.appointments], loadHistory);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const prev = items;
    setItems((current) => current.filter((row) => row.id !== id));
    try {
      await api.delete(`/api/pnl/imports/${id}`);
      showToast("Removed from import history", "success");
    } catch (err) {
      setItems(prev);
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <details className="pnl-import-history-details jarvis-help-details">
      <summary className="jarvis-help-summary">View upload log</summary>
      <div className="pnl-import-history jarvis-history">
        {loading ? (
          <p className="jarvis-history-empty text-muted">Loading import history…</p>
        ) : loadError ? (
          <p className="jarvis-history-empty text-muted">
            {loadError}. If you just updated the app, run{" "}
            <code className="pnl-import-history-code">pnpm db:migrate</code> in the server folder.
          </p>
        ) : items.length === 0 ? (
          <p className="jarvis-history-empty text-muted">
            No CSV uploads logged yet. Expenses and sales shown above may come from JARVIS, manual
            entry, or older imports. Use Upload Expenses CSV or Upload Sales CSV to add a file here
            after each successful import.
          </p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <div className="jarvis-history-row-main">
                  <div className="jarvis-history-row-top">
                    <time dateTime={item.createdAt}>{formatImportTime(item.createdAt)}</time>
                    <span className={importTypeBadgeClass(item.importType)}>
                      {importTypeLabel(item.importType)}
                    </span>
                  </div>
                  <span className="jarvis-history-raw" title={item.fileName}>
                    {item.fileName}
                  </span>
                  <span className="jarvis-history-preview">
                    {item.rowCount} imported
                    {item.skippedCount > 0 ? ` · ${item.skippedCount} skipped` : ""}
                    {(item.summaryStats?.errorCount ?? 0) > 0
                      ? ` · ${item.summaryStats?.errorCount} row errors`
                      : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className="jarvis-history-delete"
                  aria-label="Delete import history entry"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
