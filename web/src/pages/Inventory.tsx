import {
  INVENTORY_CATEGORIES,
  INVENTORY_CATEGORY_KEYS,
} from "@fallen-sparrow/shared/constants";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  useAuth,
  useIsManager,
  useIsOwner,
} from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { formatCurrency, formatDateTime } from "@/lib/format";

type StockStatus = "out" | "low" | "ok";

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderThreshold: number | null;
  idealStock: number | null;
  notes: string | null;
  status: StockStatus;
}

interface InventorySnapshot {
  outCount: number;
  lowCount: number;
  okCount: number;
  criticalCount: number;
  outItems: InventoryItem[];
  lowItems: InventoryItem[];
}

interface InventoryTransaction {
  id: string;
  type: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
}

const CATEGORY_PILLS = [
  { value: "all", label: "All" },
  ...INVENTORY_CATEGORY_KEYS.filter((key) => key !== "other").map((key) => ({
    value: key,
    label: INVENTORY_CATEGORIES[key].label,
  })),
] as const;

const CATEGORY_OPTIONS = INVENTORY_CATEGORY_KEYS.map((key) => ({
  value: key,
  label: INVENTORY_CATEGORIES[key].label,
}));

type StatusFilter = "all" | StockStatus;

type InventoryPageTab = "current" | "history";

type MonthlyItemStatus = "ran_out" | "ended_low" | "ok";

interface MonthlyItemSnapshot {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  used: number;
  restocked: number;
  closingStock: number;
  status: MonthlyItemStatus;
}

interface MonthlyInventoryHistory {
  month: string;
  restockEventCount: number;
  itemsRanOutCount: number;
  supplySpend: number;
  items: MonthlyItemSnapshot[];
}

interface MonthOption {
  year: number;
  month: number;
  label: string;
  value: string;
}

function buildMonthOptions(): MonthOption[] {
  const options: MonthOption[] = [];
  const now = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const baseLabel = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    options.push({
      year,
      month,
      value,
      label: i === 0 ? `${baseLabel} (current)` : baseLabel,
    });
  }
  return options;
}

function monthlyStatusLabel(status: MonthlyItemStatus): string {
  if (status === "ran_out") return "Ran out";
  if (status === "ended_low") return "Ended low";
  return "OK";
}

function monthlyStatusBadgeClass(status: MonthlyItemStatus): string {
  if (status === "ran_out") return "inventory-history-badge-out";
  if (status === "ended_low") return "inventory-history-badge-low";
  return "inventory-history-badge-ok";
}

function exportMonthlyHistoryCsv(data: MonthlyInventoryHistory): void {
  const headers = ["Item", "Opened", "Used", "Restocked", "Closed", "Status"];
  const rows = data.items.map((item) => [
    item.name,
    item.openingStock,
    item.used,
    item.restocked,
    item.closingStock,
    monthlyStatusLabel(item.status),
  ]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `fallen-sparrow-inventory-${data.month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function categoryLabel(value: string): string {
  if (value in INVENTORY_CATEGORIES) {
    return INVENTORY_CATEGORIES[value as keyof typeof INVENTORY_CATEGORIES].label;
  }
  return value;
}

function statusBorderClass(status: StockStatus): string {
  if (status === "out") return "inventory-card-out";
  if (status === "low") return "inventory-card-low";
  return "inventory-card-ok";
}

function transactionBadgeClass(type: string): string {
  if (type === "restock") return "inv-txn-restock";
  if (type === "use") return "inv-txn-use";
  if (type === "jarvis") return "inv-txn-jarvis";
  return "inv-txn-adjust";
}

interface ItemFormState {
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderThreshold: string;
  idealStock: string;
  notes: string;
}

const emptyForm: ItemFormState = {
  name: "",
  category: "ink",
  unit: "",
  currentStock: 0,
  reorderThreshold: "",
  idealStock: "",
  notes: "",
};

export function InventoryPage() {
  const { user } = useAuth();
  const isManager = useIsManager();
  const isOwner = useIsOwner();
  const isArtist = user?.role === "ARTIST";
  const { showToast } = useToast();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const [activeTab, setActiveTab] = useState<InventoryPageTab>("current");
  const [selectedMonth, setSelectedMonth] = useState(
    () => buildMonthOptions()[0]?.value ?? "",
  );
  const [monthlyHistory, setMonthlyHistory] = useState<MonthlyInventoryHistory | null>(
    null,
  );
  const [historyLoading, setHistoryLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<ItemFormState>(emptyForm);
  const [addSaving, setAddSaving] = useState(false);

  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [detailForm, setDetailForm] = useState<ItemFormState>(emptyForm);
  const [detailHistory, setDetailHistory] = useState<InventoryTransaction[]>([]);
  const [detailSaving, setDetailSaving] = useState(false);

  const loadSnapshot = useCallback(async () => {
    try {
      const snap = await api.get<InventorySnapshot>("/api/inventory/snapshot");
      setSnapshot(snap);
    } catch {
      setSnapshot(null);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      const qs = params.toString();
      const res = await api.get<{ items: InventoryItem[] }>(
        `/api/inventory${qs ? `?${qs}` : ""}`,
      );
      setItems(res.items);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load inventory", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, showToast]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadItems(), loadSnapshot()]);
  }, [loadItems, loadSnapshot]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEventBusRefresh([DATA_EVENTS.inventory], refreshAll);

  const selectedMonthOption = useMemo(
    () => monthOptions.find((m) => m.value === selectedMonth) ?? monthOptions[0],
    [monthOptions, selectedMonth],
  );

  const loadMonthlyHistory = useCallback(async () => {
    if (!selectedMonthOption) return;
    setHistoryLoading(true);
    try {
      const res = await api.get<MonthlyInventoryHistory>(
        `/api/inventory/history?year=${selectedMonthOption.year}&month=${selectedMonthOption.month}`,
      );
      setMonthlyHistory(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load history", "error");
      setMonthlyHistory(null);
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedMonthOption, showToast]);

  useEffect(() => {
    if (activeTab === "history" && isManager) {
      void loadMonthlyHistory();
    }
  }, [activeTab, isManager, loadMonthlyHistory]);

  const sortedItems = useMemo(() => {
    const priority = (s: StockStatus) => (s === "out" ? 0 : s === "low" ? 1 : 2);
    return [...items].sort((a, b) => {
      const pd = priority(a.status) - priority(b.status);
      if (pd !== 0) return pd;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const openDetail = async (item: InventoryItem) => {
    setDetailItem(item);
    setDetailForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock,
      reorderThreshold: item.reorderThreshold?.toString() ?? "",
      idealStock: item.idealStock?.toString() ?? "",
      notes: item.notes ?? "",
    });
    if (isManager) {
      try {
        const res = await api.get<{ transactions: InventoryTransaction[] }>(
          `/api/inventory/${item.id}/history`,
        );
        setDetailHistory(res.transactions.slice(0, 10));
      } catch {
        setDetailHistory([]);
      }
    } else {
      setDetailHistory([]);
    }
  };

  const adjustStock = async (
    item: InventoryItem,
    delta: number,
    type: "restock" | "use",
  ) => {
    const prev = items;
    setItems((list) =>
      list.map((row) =>
        row.id === item.id
          ? {
              ...row,
              currentStock: Math.max(0, row.currentStock + delta),
              status:
                Math.max(0, row.currentStock + delta) === 0
                  ? "out"
                  : row.reorderThreshold != null &&
                      Math.max(0, row.currentStock + delta) <= row.reorderThreshold
                    ? "low"
                    : "ok",
            }
          : row,
      ),
    );

    try {
      const res = await api.post<{ newStock: number; status: StockStatus }>(
        `/api/inventory/${item.id}/adjust`,
        { quantity: delta, type },
      );
      setItems((list) =>
        list.map((row) =>
          row.id === item.id
            ? { ...row, currentStock: res.newStock, status: res.status }
            : row,
        ),
      );
      if (detailItem?.id === item.id) {
        setDetailItem((d) =>
          d ? { ...d, currentStock: res.newStock, status: res.status } : d,
        );
      }
      await loadSnapshot();
      emitData(DATA_EVENTS.inventory);
    } catch (err) {
      setItems(prev);
      showToast(err instanceof Error ? err.message : "Adjust failed", "error");
    }
  };

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    try {
      await api.post("/api/inventory", {
        name: addForm.name.trim(),
        category: addForm.category,
        unit: addForm.unit.trim(),
        currentStock: addForm.currentStock,
        reorderThreshold: addForm.reorderThreshold
          ? Number(addForm.reorderThreshold)
          : null,
        idealStock: addForm.idealStock ? Number(addForm.idealStock) : null,
        notes: addForm.notes.trim() || null,
      });
      showToast("Item added", "success");
      emitData(DATA_EVENTS.inventory);
      setAddOpen(false);
      setAddForm(emptyForm);
      await refreshAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setAddSaving(false);
    }
  };

  const handleDetailSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!detailItem) return;
    setDetailSaving(true);
    try {
      const res = await api.put<{ item: InventoryItem }>(`/api/inventory/${detailItem.id}`, {
        name: detailForm.name.trim(),
        category: detailForm.category,
        unit: detailForm.unit.trim(),
        currentStock: detailForm.currentStock,
        reorderThreshold: detailForm.reorderThreshold
          ? Number(detailForm.reorderThreshold)
          : null,
        idealStock: detailForm.idealStock ? Number(detailForm.idealStock) : null,
        notes: detailForm.notes.trim() || null,
      });
      showToast("Item updated", "success");
      emitData(DATA_EVENTS.inventory);
      setDetailItem(res.item);
      await refreshAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setDetailSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detailItem) return;
    if (!window.confirm(`Remove ${detailItem.name} from inventory?`)) return;
    try {
      await api.delete(`/api/inventory/${detailItem.id}`);
      showToast("Item removed", "success");
      emitData(DATA_EVENTS.inventory);
      setDetailItem(null);
      await refreshAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="page inventory-page">
      <header className="inventory-header">
        <div>
          <h1 className="inventory-title">Inventory</h1>
          <p className="inventory-subtitle">Update via JARVIS or adjust manually below</p>
        </div>
        {isManager && (
          <button type="button" className="btn-amber" onClick={() => setAddOpen(true)}>
            + Add item
          </button>
        )}
      </header>

      <div className="inventory-tabs">
        <button
          type="button"
          className={activeTab === "current" ? "active" : ""}
          onClick={() => setActiveTab("current")}
        >
          Current Stock
        </button>
        {isManager && (
          <button
            type="button"
            className={activeTab === "history" ? "active" : ""}
            onClick={() => setActiveTab("history")}
          >
            Monthly History
          </button>
        )}
      </div>

      {activeTab === "current" && (
        <>
      <div className="inventory-stat-chips">
        <button
          type="button"
          className={`inventory-stat-chip inventory-stat-out${statusFilter === "out" ? " active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "out" ? "all" : "out")}
        >
          <span className="inventory-stat-label">Out of stock</span>
          <span className="inventory-stat-value">{snapshot?.outCount ?? 0}</span>
        </button>
        <button
          type="button"
          className={`inventory-stat-chip inventory-stat-low${statusFilter === "low" ? " active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "low" ? "all" : "low")}
        >
          <span className="inventory-stat-label">Low stock</span>
          <span className="inventory-stat-value">{snapshot?.lowCount ?? 0}</span>
        </button>
        <button
          type="button"
          className={`inventory-stat-chip inventory-stat-ok${statusFilter === "ok" ? " active" : ""}`}
          onClick={() => setStatusFilter(statusFilter === "ok" ? "all" : "ok")}
        >
          <span className="inventory-stat-label">Well stocked</span>
          <span className="inventory-stat-value">{snapshot?.okCount ?? 0}</span>
        </button>
      </div>

      <div className="inventory-category-pills">
        {CATEGORY_PILLS.map((pill) => (
          <button
            key={pill.value}
            type="button"
            className={`inventory-pill${categoryFilter === pill.value ? " active" : ""}`}
            onClick={() => setCategoryFilter(pill.value)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-muted">Loading inventory...</p>}
      {!loading && sortedItems.length === 0 && (
        <EmptyState
          icon="📦"
          title="No inventory items yet"
          description="Add your first item manually, or let JARVIS track supplies when you mention them in a brain dump."
          ctaLabel="Open JARVIS"
          ctaTo="/jarvis"
        />
      )}

      <div className="inventory-grid">
        {sortedItems.map((item) => (
          <article
            key={item.id}
            className={`inventory-card ${statusBorderClass(item.status)}`}
          >
            <div className="inventory-card-top">
              <span className={`inventory-badge inventory-badge-${item.status}`}>
                {item.status === "out" ? "OUT" : item.status === "low" ? "LOW" : "OK"}
              </span>
              <span className="inventory-card-category">{categoryLabel(item.category)}</span>
            </div>
            <button
              type="button"
              className="inventory-card-name"
              onClick={() => void openDetail(item)}
            >
              {item.name}
            </button>
            <div className="inventory-adjuster">
              {!isArtist && (
                <button
                  type="button"
                  className="inventory-adj-btn"
                  aria-label={`Decrease ${item.name}`}
                  onClick={() => void adjustStock(item, -1, "use")}
                >
                  −
                </button>
              )}
              <div className="inventory-stock-center">
                <span className={`inventory-stock-num inventory-stock-${item.status}`}>
                  {item.currentStock}
                </span>
                <span className="inventory-stock-unit">{item.unit}</span>
              </div>
              {!isArtist && (
                <button
                  type="button"
                  className="inventory-adj-btn"
                  aria-label={`Increase ${item.name}`}
                  onClick={() => void adjustStock(item, 1, "restock")}
                >
                  +
                </button>
              )}
            </div>
            <footer className="inventory-card-footer">
              Reorder at {item.reorderThreshold ?? "n/a"} · Ideal {item.idealStock ?? "n/a"}
            </footer>
          </article>
        ))}
      </div>

      <div className="inventory-jarvis-bar">
        <span className="inventory-jarvis-icon" aria-hidden>
          🤖
        </span>
        <div className="inventory-jarvis-copy">
          <div className="inventory-jarvis-title">Update via JARVIS</div>
          <div className="inventory-jarvis-examples">
            &quot;Got 3 boxes of round liners from Kingpin&quot; · &quot;Used the last thermal
            paper roll&quot; · &quot;Running low on black ink&quot;
          </div>
        </div>
        <Link to="/jarvis" className="btn-dark">
          Open JARVIS
        </Link>
      </div>
        </>
      )}

      {activeTab === "history" && isManager && (
        <div className="inventory-history-tab">
          <div className="inventory-history-toolbar">
            <select
              className="inventory-history-month-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              aria-label="Select month"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inventory-history-chips">
            <div className="inventory-history-chip inventory-history-chip-neutral">
              <span className="inventory-history-chip-label">Restock events</span>
              <span className="inventory-history-chip-value">
                {monthlyHistory?.restockEventCount ?? 0}
              </span>
            </div>
            <div className="inventory-history-chip inventory-history-chip-out">
              <span className="inventory-history-chip-label">Ran out</span>
              <span className="inventory-history-chip-value">
                {monthlyHistory?.itemsRanOutCount ?? 0}
              </span>
            </div>
            <div className="inventory-history-chip inventory-history-chip-neutral">
              <span className="inventory-history-chip-label">Supply spend</span>
              <span className="inventory-history-chip-value">
                {formatCurrency(monthlyHistory?.supplySpend ?? 0)}
              </span>
            </div>
          </div>

          {historyLoading && <p className="text-muted">Loading monthly history...</p>}

          {!historyLoading && monthlyHistory && (
            <>
              <div className="table-wrap inventory-history-table-wrap">
                <table className="inventory-history-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Opened</th>
                      <th>Used</th>
                      <th>Restocked</th>
                      <th>Closed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyHistory.items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-muted">
                          No inventory items for this month.
                        </td>
                      </tr>
                    )}
                    {monthlyHistory.items.map((item) => (
                      <tr
                        key={item.id}
                        className={`inventory-history-row-${item.status}`}
                      >
                        <td className="inventory-history-item-name">{item.name}</td>
                        <td>{item.openingStock}</td>
                        <td>{item.used}</td>
                        <td>{item.restocked}</td>
                        <td>{item.closingStock}</td>
                        <td>
                          <span
                            className={`inventory-history-badge ${monthlyStatusBadgeClass(item.status)}`}
                          >
                            {monthlyStatusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <footer className="inventory-history-footer">
                <p className="inventory-history-computed text-muted">
                  Stock levels computed from transaction history for{" "}
                  {selectedMonthOption?.label.replace(" (current)", "") ?? monthlyHistory.month}.
                </p>
                <button
                  type="button"
                  className="btn-dark"
                  onClick={() => exportMonthlyHistoryCsv(monthlyHistory)}
                >
                  Export CSV
                </button>
              </footer>
            </>
          )}
        </div>
      )}

      {addOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setAddOpen(false)}>
          <div
            className="modal-panel inventory-modal"
            role="dialog"
            aria-label="Add inventory item"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Add Item</h2>
            <form onSubmit={(e) => void handleAddSubmit(e)} className="inventory-form">
              <label>
                Item name
                <input
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                />
              </label>
              <label>
                Category
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Unit
                <input
                  required
                  placeholder="bottle, box, pack, roll"
                  value={addForm.unit}
                  onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                />
              </label>
              <label>
                Current stock
                <input
                  type="number"
                  min={0}
                  required
                  value={addForm.currentStock}
                  onChange={(e) =>
                    setAddForm({ ...addForm, currentStock: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Reorder at
                <input
                  type="number"
                  min={0}
                  value={addForm.reorderThreshold}
                  onChange={(e) =>
                    setAddForm({ ...addForm, reorderThreshold: e.target.value })
                  }
                />
              </label>
              <label>
                Ideal stock
                <input
                  type="number"
                  min={0}
                  value={addForm.idealStock}
                  onChange={(e) => setAddForm({ ...addForm, idealStock: e.target.value })}
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={2}
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn-dark" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-amber" disabled={addSaving}>
                  {addSaving ? "Saving..." : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailItem && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="modal-panel inventory-modal inventory-detail-modal"
            role="dialog"
            aria-label="Item detail"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{detailItem.name}</h2>
            <span className={`inventory-badge inventory-badge-${detailItem.status}`}>
              {detailItem.status === "out"
                ? "OUT"
                : detailItem.status === "low"
                  ? "LOW"
                  : "OK"}
            </span>

            <div className="inventory-adjuster inventory-adjuster-lg">
              {!isArtist && (
                <button
                  type="button"
                  className="inventory-adj-btn inventory-adj-btn-lg"
                  onClick={() => void adjustStock(detailItem, -1, "use")}
                >
                  −
                </button>
              )}
              <div className="inventory-stock-center">
                <span
                  className={`inventory-stock-num inventory-stock-num-lg inventory-stock-${detailItem.status}`}
                >
                  {detailItem.currentStock}
                </span>
                <span className="inventory-stock-unit">{detailItem.unit}</span>
              </div>
              {!isArtist && (
                <button
                  type="button"
                  className="inventory-adj-btn inventory-adj-btn-lg"
                  onClick={() => void adjustStock(detailItem, 1, "restock")}
                >
                  +
                </button>
              )}
            </div>

            {isManager && (
              <form onSubmit={(e) => void handleDetailSave(e)} className="inventory-form">
                <label>
                  Item name
                  <input
                    required
                    value={detailForm.name}
                    onChange={(e) => setDetailForm({ ...detailForm, name: e.target.value })}
                  />
                </label>
                <label>
                  Category
                  <select
                    value={detailForm.category}
                    onChange={(e) =>
                      setDetailForm({ ...detailForm, category: e.target.value })
                    }
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Unit
                  <input
                    required
                    value={detailForm.unit}
                    onChange={(e) => setDetailForm({ ...detailForm, unit: e.target.value })}
                  />
                </label>
                <label>
                  Current stock
                  <input
                    type="number"
                    min={0}
                    required
                    value={detailForm.currentStock}
                    onChange={(e) =>
                      setDetailForm({
                        ...detailForm,
                        currentStock: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Reorder at
                  <input
                    type="number"
                    min={0}
                    value={detailForm.reorderThreshold}
                    onChange={(e) =>
                      setDetailForm({ ...detailForm, reorderThreshold: e.target.value })
                    }
                  />
                </label>
                <label>
                  Ideal stock
                  <input
                    type="number"
                    min={0}
                    value={detailForm.idealStock}
                    onChange={(e) =>
                      setDetailForm({ ...detailForm, idealStock: e.target.value })
                    }
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows={2}
                    value={detailForm.notes}
                    onChange={(e) => setDetailForm({ ...detailForm, notes: e.target.value })}
                  />
                </label>
                <div className="modal-actions">
                  {isOwner && (
                    <button type="button" className="btn-dark btn-danger" onClick={() => void handleDelete()}>
                      Delete Item
                    </button>
                  )}
                  <button type="submit" className="btn-amber" disabled={detailSaving}>
                    {detailSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            )}

            {isManager && (
              <section className="inventory-history">
                <h3>Transaction History</h3>
                {detailHistory.length === 0 && (
                  <p className="text-muted">No transactions yet.</p>
                )}
                <ul className="inventory-history-list">
                  {detailHistory.map((txn) => (
                    <li key={txn.id} className="inventory-history-row">
                      <span className={`inv-txn-badge ${transactionBadgeClass(txn.type)}`}>
                        {txn.type.toUpperCase()}
                      </span>
                      <span className={txn.quantity >= 0 ? "inv-txn-pos" : "inv-txn-neg"}>
                        {txn.quantity >= 0 ? "+" : ""}
                        {txn.quantity}
                      </span>
                      <span className="inv-txn-notes">{txn.notes ?? ""}</span>
                      <span className="inv-txn-time text-muted">
                        {formatDateTime(txn.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <button
              type="button"
              className="btn-dark inventory-detail-close"
              onClick={() => setDetailItem(null)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
