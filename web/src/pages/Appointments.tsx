import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { DATA_EVENTS } from "@/lib/eventBus";
import { formatCurrency, formatServiceType } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { buildTimelineRange, type PeriodKey } from "@/lib/timeline";

interface AppointmentRow {
  id: string;
  serviceType: string;
  artistId: string | null;
  artistName: string | null;
  customerId: string | null;
  customerName: string | null;
  totalRevenue: number;
  artistPayout: number;
  appointmentDate: string;
}

interface ListResponse {
  rows: AppointmentRow[];
  total: number;
  page: number;
  totalPages: number;
}

export function AppointmentsPage() {
  const { user } = useAuth();
  const hideCommission = user?.role === "ARTIST";
  const [searchParams] = useSearchParams();
  const defaultFrom =
    searchParams.get("from") ??
    buildTimelineRange(new Date().getUTCFullYear(), "this_month").from;
  const defaultTo =
    searchParams.get("to") ??
    buildTimelineRange(new Date().getUTCFullYear(), "this_month").to;

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [from] = useState(defaultFrom);
  const [to] = useState(defaultTo);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "25",
        from,
        to,
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get<ListResponse>(`/api/appointments?${params}`);
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventBusRefresh([DATA_EVENTS.appointments], load);

  const rangeLabel = useMemo(() => {
    if (!data) return "";
    const start = (data.page - 1) * 25 + 1;
    const end = Math.min(data.page * 25, data.total);
    return `Showing ${start}–${end} of ${data.total}`;
  }, [data]);

  return (
    <div className="appointments-page">
      <h1>Appointment Records ({data?.total ?? 0})</h1>
      <input
        type="search"
        className="search-input"
        placeholder="Search by service, artist, client..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Service Type</th>
              <th>Artist</th>
              <th>Client</th>
              <th>Revenue</th>
              {!hideCommission && <th>Artist Payout</th>}
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={hideCommission ? 5 : 6}>Loading...</td>
              </tr>
            )}
            {!loading &&
              data?.rows.map((row) => (
                <tr key={row.id}>
                  <td>{formatServiceType(row.serviceType)}</td>
                  <td>{row.artistName ?? "n/a"}</td>
                  <td>{row.customerName ?? "n/a"}</td>
                  <td className="value-amber">{formatCurrency(row.totalRevenue)}</td>
                  {!hideCommission && <td>{formatCurrency(row.artistPayout)}</td>}
                  <td>{row.appointmentDate}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        Appointment data is sourced from Porter. Records are managed in your booking system.
      </p>
      <div className="pagination">
        <span>{rangeLabel}</span>
        <div>
          <button
            type="button"
            disabled={!data || data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!data || data.page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
