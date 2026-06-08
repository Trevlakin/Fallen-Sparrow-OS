import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ContinuityDrawer } from "@/components/ContinuityDrawer";
import { EmptyState } from "@/components/EmptyState";
import { useIsManager } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { DATA_EVENTS } from "@/lib/eventBus";
import { formatCurrency } from "@/lib/format";

interface CustomerListItem {
  customerId: string;
  name: string;
  lastAppointmentDate: string | null;
  daysSinceLastAppointment: number | null;
  isOverdue: boolean;
}

interface TopReferrer {
  customerId: string;
  name: string;
  referralCount: number;
  totalReferredRevenue: number;
}

type FilterTab = "all" | "overdue";

function formatDate(iso: string | null): string {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleDateString();
}

export function CustomersPage() {
  const isManager = useIsManager();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("overdue") === "true" ? "overdue" : "all";
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [referrers, setReferrers] = useState<TopReferrer[]>([]);
  const [filterTab, setFilterTab] = useState<FilterTab>(initialTab);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [referrersOpen, setReferrersOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("overdue") === "true") {
      setFilterTab("overdue");
    }
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const q = filterTab === "overdue" ? "?overdue=true" : "";
    void api
      .get<{ customers: CustomerListItem[] }>(`/api/customers${q}`)
      .then((res) => setCustomers(res.customers))
      .finally(() => setLoading(false));
  }, [filterTab]);

  const reloadCustomers = useCallback(() => {
    setLoading(true);
    const q = filterTab === "overdue" ? "?overdue=true" : "";
    void api
      .get<{ customers: CustomerListItem[] }>(`/api/customers${q}`)
      .then((res) => setCustomers(res.customers))
      .finally(() => setLoading(false));
  }, [filterTab]);

  useEventBusRefresh(
    [DATA_EVENTS.nudges, DATA_EVENTS.appointments],
    reloadCustomers,
  );

  useEffect(() => {
    if (!isManager) return;
    void api
      .get<{ referrers: TopReferrer[] }>("/api/customers/top-referrers?limit=5")
      .then((res) => setReferrers(res.referrers))
      .catch(() => setReferrers([]));
  }, [isManager]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(q));
  }, [customers, debouncedSearch]);

  return (
    <div className="page customers-page">
      <h1>Customers</h1>
      <p className="text-muted">
        Client continuity profiles. Overdue clients may receive a friendly rebooking nudge.
      </p>

      <input
        type="search"
        className="search-input"
        placeholder="Search clients..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-tabs">
        <button
          type="button"
          className={filterTab === "all" ? "tab active" : "tab"}
          onClick={() => setFilterTab("all")}
        >
          All
        </button>
        <button
          type="button"
          className={filterTab === "overdue" ? "tab active" : "tab"}
          onClick={() => setFilterTab("overdue")}
        >
          Overdue
        </button>
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && filtered.length === 0 && (
        <EmptyState
          icon="👥"
          title="No clients found"
          description="Your client list syncs from Porter appointments. Import a CSV to get started."
          ctaLabel="Import data"
          ctaTo="/pnl"
        />
      )}

      {!loading && filtered.length > 0 && (
        <>
          <div className="table-wrap customers-table-desktop">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Last Visit</th>
                  <th>Days Since</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4}>No clients found</td>
                  </tr>
                )}
                {filtered.map((c) => (
                  <tr
                    key={c.customerId}
                    className="clickable-row"
                    onClick={() => setDrawerId(c.customerId)}
                  >
                    <td>{c.name}</td>
                    <td>
                      {c.isOverdue ? (
                        <span className="overdue-badge">Overdue</span>
                      ) : (
                        <span className="status-badge-active">Active</span>
                      )}
                    </td>
                    <td>{formatDate(c.lastAppointmentDate)}</td>
                    <td>{c.daysSinceLastAppointment ?? "n/a"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="customer-cards-mobile">
            {filtered.map((c) => (
              <li key={c.customerId}>
                <button
                  type="button"
                  className="customer-card"
                  onClick={() => setDrawerId(c.customerId)}
                >
                  <div className="customer-card-header">
                    <span className="customer-card-name">{c.name}</span>
                    {c.isOverdue ? (
                      <span className="overdue-badge">Overdue</span>
                    ) : (
                      <span className="status-badge-active">Active</span>
                    )}
                  </div>
                  <p className="text-muted">
                    Last visit: {formatDate(c.lastAppointmentDate)}
                    {c.daysSinceLastAppointment != null &&
                      ` · ${c.daysSinceLastAppointment} days ago`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isManager && referrers.length > 0 && (
        <section className="referrers-accordion">
          <button
            type="button"
            className="accordion-trigger"
            onClick={() => setReferrersOpen((o) => !o)}
            aria-expanded={referrersOpen}
          >
            Top Referrers
            <span>{referrersOpen ? "−" : "+"}</span>
          </button>
          {referrersOpen && (
            <ul className="referrers-list">
              {referrers.map((r) => (
                <li key={r.customerId}>
                  <button
                    type="button"
                    className="client-link"
                    onClick={() => setDrawerId(r.customerId)}
                  >
                    {r.name}
                  </button>
                  <span className="text-muted">
                    {r.referralCount} referrals ·{" "}
                    {formatCurrency(r.totalReferredRevenue)} referred revenue
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ContinuityDrawer customerId={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  );
}
