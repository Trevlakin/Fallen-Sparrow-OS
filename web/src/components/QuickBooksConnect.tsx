import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/context/ToastContext";

interface QuickBooksStatus {
  connected: boolean;
  lastSynced?: string;
  companyName?: string;
  configured?: boolean;
}

interface SyncResponse {
  synced: number;
  errors: number;
  message: string;
}

export function QuickBooksConnect() {
  const { showToast } = useToast();
  const [status, setStatus] = useState<QuickBooksStatus>({ connected: false });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadStatus = async () => {
    try {
      const next = await api.get<QuickBooksStatus>("/api/quickbooks/status");
      setStatus(next);
    } catch {
      showToast("Could not load QuickBooks status", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();

    const params = new URLSearchParams(window.location.search);
    const qbParam = params.get("quickbooks");
    if (qbParam === "connected") {
      showToast("QuickBooks connected successfully", "success");
      void loadStatus();
      window.history.replaceState({}, "", window.location.pathname);
    } else if (qbParam === "error") {
      showToast("QuickBooks connection failed. Please try again.", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [showToast]);

  const handleConnect = async () => {
    try {
      const res = await api.get<{ authUrl: string }>("/api/quickbooks/auth-url");
      window.location.href = res.authUrl;
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to start QuickBooks connect",
        "error",
      );
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const startDate = `${new Date().getFullYear()}-01-01`;
      const endDate = new Date().toISOString().split("T")[0]!;
      const res = await api.post<SyncResponse>("/api/quickbooks/sync", {
        startDate,
        endDate,
      });
      showToast(res.message, res.errors > 0 ? "error" : "success");
      await loadStatus();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "QuickBooks sync failed",
        "error",
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (
      !window.confirm(
        "Disconnect QuickBooks? Synced data will remain but auto-sync will stop.",
      )
    ) {
      return;
    }
    try {
      await api.delete("/api/quickbooks/disconnect");
      setStatus({ connected: false });
      showToast("QuickBooks disconnected", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to disconnect QuickBooks",
        "error",
      );
    }
  };

  if (loading) {
    return <p className="text-muted">Checking QuickBooks status...</p>;
  }

  return (
    <div className="qb-connect-card">
      <div className="qb-connect-header">
        <div className="qb-connect-title">
          <span className="qb-connect-icon" aria-hidden="true">
            QB
          </span>
          <span>QuickBooks</span>
        </div>
        <span
          className={`qb-connect-badge ${
            status.connected ? "qb-connect-badge-connected" : ""
          }`}
        >
          {status.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      <div className="qb-connect-body">
        {!status.configured && (
          <p className="text-muted">
            QuickBooks credentials are not configured on the server yet.
          </p>
        )}

        {status.connected && status.companyName && (
          <p className="text-muted qb-connect-company">{status.companyName}</p>
        )}

        {!status.connected ? (
          <>
            <p className="text-muted">
              Connect QuickBooks to automatically sync expenses, categorize
              transactions, and pull your P&amp;L data. No more manual entry.
            </p>
            <button
              type="button"
              className="btn-qb-connect"
              onClick={() => void handleConnect()}
              disabled={!status.configured}
            >
              Connect QuickBooks
            </button>
          </>
        ) : (
          <>
            {status.lastSynced && (
              <p className="text-muted qb-connect-last-sync">
                Last synced: {new Date(status.lastSynced).toLocaleString()}
              </p>
            )}
            <p className="text-muted">
              Expenses and transactions sync from QuickBooks. Tap sync to pull
              the latest data now.
            </p>
            <div className="qb-connect-actions">
              <button
                type="button"
                className="btn-dark"
                onClick={() => void handleSync()}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Sync now"}
              </button>
              <button
                type="button"
                className="btn-qb-disconnect"
                onClick={() => void handleDisconnect()}
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
