import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EXPENSE_CATEGORIES, type ExpenseCategoryKey } from "@fallen-sparrow/shared/constants";
import {
  SCHEMA_SERVICE_TYPES,
  SERVICE_TYPE_LABELS,
  type SchemaServiceType,
} from "@fallen-sparrow/shared/serviceTypes";
import { api } from "@/lib/api";
import { CsvColumnMapperModal } from "@/components/CsvColumnMapperModal";
import { ImportResultBlock } from "@/components/ImportResultBlock";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PnlImportHistory } from "@/components/PnlImportHistory";
import { PnlArtistSessionsDrawer } from "@/components/PnlArtistSessionsDrawer";
import { APPOINTMENT_CSV_FIELDS, EXPENSE_CSV_FIELDS } from "@/lib/csvMappingFields";
import type { ImportResult } from "@/lib/csvImport";
import { emitCsvImport, emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { useIsManager } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatCurrency, formatPercent, formatServiceType, toDateInput } from "@/lib/format";

interface PnlArtistLine {
  artistName: string;
  revenue: number;
  payout: number;
  shopKeepsPercent: number;
  appointmentCount: number;
  tierLabel: string;
}

interface PnlSummary {
  totalRevenue: number;
  totalCogs: number;
  totalPayroll: number;
  totalFixedExpenses: number;
  netProfit: number;
  marginPercent: number;
  byArtist: Record<string, PnlArtistLine>;
  byService: Record<string, { revenue: number; profit: number; margin: number }>;
  expensesByCategory: Record<string, { total: number; items: Array<{ description: string; amount: number }> }>;
}

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORIES).map(([key, meta]) => ({
  key: key as ExpenseCategoryKey,
  label: meta.name,
}));

const SERVICE_TYPE_OPTIONS = SCHEMA_SERVICE_TYPES.map((key) => ({
  key,
  label: SERVICE_TYPE_LABELS[key],
}));

const CUSTOM_ARTIST_VALUE = "__custom__";

interface ManualArtistOption {
  id: string;
  name: string;
  isActive: boolean;
}

export function PnlPage() {
  const now = new Date();
  const isManager = useIsManager();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [from, setFrom] = useState(toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(toDateInput(now));
  const [pnl, setPnl] = useState<PnlSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [artistOptions, setArtistOptions] = useState<ManualArtistOption[]>([]);
  const [expenseDate, setExpenseDate] = useState(toDateInput(now));
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategoryKey>("SUPPLIES");
  const [description, setDescription] = useState("");
  const [saleDate, setSaleDate] = useState(toDateInput(now));
  const [artistId, setArtistId] = useState("");
  const [artistName, setArtistName] = useState("");
  const [clientName, setClientName] = useState("");
  const [serviceType, setServiceType] = useState<SchemaServiceType>("tattoo");
  const [saleRevenue, setSaleRevenue] = useState("");
  const [artistPayout, setArtistPayout] = useState("");
  const [saleNotes, setSaleNotes] = useState("");
  const [csvMapperOpen, setCsvMapperOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [pendingCsvFormat, setPendingCsvFormat] = useState<"expenses" | "appointments">(
    "expenses",
  );
  const [pendingFileName, setPendingFileName] = useState<string | undefined>(undefined);
  const [expensesResult, setExpensesResult] = useState<ImportResult | null>(null);
  const [expensesImportError, setExpensesImportError] = useState<string | null>(null);
  const [salesResult, setSalesResult] = useState<ImportResult | null>(null);
  const [salesImportError, setSalesImportError] = useState<string | null>(null);
  const [sessionsArtistId, setSessionsArtistId] = useState<string | null>(null);
  const [sessionsArtistName, setSessionsArtistName] = useState("");
  const expensesFileRef = useRef<HTMLInputElement>(null);
  const salesFileRef = useRef<HTMLInputElement>(null);

  const loadPnl = () => {
    setLoading(true);
    void api
      .get<PnlSummary>(`/api/pnl/range?start=${from}&end=${to}`)
      .then(setPnl)
      .finally(() => setLoading(false));
  };

  useEventBusRefresh([DATA_EVENTS.expenses, DATA_EVENTS.appointments], loadPnl);

  useEffect(() => {
    loadPnl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => {
    const prefillDesc = searchParams.get("expenseDesc");
    const prefillDate = searchParams.get("expenseDate");
    if (prefillDesc || prefillDate) {
      setExpenseModalOpen(true);
      if (prefillDesc) setDescription(prefillDesc);
      if (prefillDate) setExpenseDate(prefillDate);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!saleModalOpen || !isManager) return;
    void api
      .get<{ artists: ManualArtistOption[] }>("/api/manual/artists")
      .then((res) => setArtistOptions(res.artists))
      .catch(() => setArtistOptions([]));
  }, [saleModalOpen, isManager]);

  const resetExpenseModal = () => {
    setExpenseDate(toDateInput(new Date()));
    setVendor("");
    setAmount("");
    setCategory("SUPPLIES");
    setDescription("");
  };

  const resetSaleModal = () => {
    setSaleDate(toDateInput(new Date()));
    setArtistId("");
    setArtistName("");
    setClientName("");
    setServiceType("tattoo");
    setSaleRevenue("");
    setArtistPayout("");
    setSaleNotes("");
  };

  const handleSubmitExpense = async (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = Number.parseFloat(amount);
    if (!vendor.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast("Enter a vendor and valid amount", "error");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/api/manual/expense", {
        vendor: vendor.trim(),
        amount: parsedAmount,
        category,
        description: description.trim(),
        expenseDate,
      });
      showToast("Expense logged", "success");
      emitData(DATA_EVENTS.expenses);
      setExpenseModalOpen(false);
      resetExpenseModal();
      loadPnl();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to log expense", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSale = async (e: FormEvent) => {
    e.preventDefault();
    const parsedRevenue = Number.parseFloat(saleRevenue);
    if (!clientName.trim() || !Number.isFinite(parsedRevenue) || parsedRevenue <= 0) {
      showToast("Enter client name and valid revenue", "error");
      return;
    }
    if (!artistId && !artistName.trim()) {
      showToast("Select an artist or enter a name", "error");
      return;
    }

    let parsedPayout: number | undefined;
    if (artistPayout.trim() !== "") {
      parsedPayout = Number.parseFloat(artistPayout);
      if (!Number.isFinite(parsedPayout) || parsedPayout < 0) {
        showToast("Enter a valid artist payout or leave blank for default rate", "error");
        return;
      }
    }

    setSaleSubmitting(true);
    try {
      await api.post("/api/manual/sale", {
        appointmentDate: saleDate,
        clientName: clientName.trim(),
        serviceType,
        totalRevenue: parsedRevenue,
        ...(artistId && artistId !== CUSTOM_ARTIST_VALUE
          ? { artistId }
          : { artistName: artistName.trim() }),
        ...(parsedPayout !== undefined ? { artistPayout: parsedPayout } : {}),
        ...(saleNotes.trim() ? { notes: saleNotes.trim() } : {}),
      });
      showToast("Sale logged", "success");
      emitData(DATA_EVENTS.appointments);
      emitData(DATA_EVENTS.followups);
      setSaleModalOpen(false);
      resetSaleModal();
      loadPnl();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to log sale", "error");
    } finally {
      setSaleSubmitting(false);
    }
  };

  const handleCsvFileSelected = async (file: File, format: "expenses" | "appointments") => {
    if (format === "expenses") {
      setExpensesResult(null);
      setExpensesImportError(null);
    } else {
      setSalesResult(null);
      setSalesImportError(null);
    }
    const csv = await file.text();
    setPendingCsv(csv);
    setPendingCsvFormat(format);
    setPendingFileName(file.name);
    setCsvMapperOpen(true);
  };

  const handleImportComplete = (result: ImportResult) => {
    if (pendingCsvFormat === "expenses") {
      setExpensesResult(result);
      if (result.imported > 0) {
        showToast(`${result.imported} expenses imported. Dashboard updated.`, "success");
        emitCsvImport("expenses");
        loadPnl();
      }
      return;
    }

    setSalesResult(result);
    if (result.imported > 0) {
      showToast(`${result.imported} sales imported. Dashboard updated.`, "success");
      emitCsvImport("appointments");
      loadPnl();
    }
  };

  return (
    <div className="page pnl-page">
      <header className="pnl-page-header">
        <div className="pnl-page-header-top">
          <div>
            <h1>Profit &amp; Loss</h1>
            <p className="pnl-page-intro">
              See how much the shop earned and spent for any date range. Revenue comes from
              completed sales; expenses include supplies, rent, payroll, and everything else you
              log or import.
            </p>
          </div>
          {isManager && (
            <div className="pnl-page-search">
              <GlobalSearch
                placeholder="Search sales, expenses, customers, artists…"
              />
            </div>
          )}
        </div>
      </header>

      {isManager && (
        <section className="pnl-data-section" aria-labelledby="pnl-data-heading">
          <h2 id="pnl-data-heading" className="pnl-section-heading">
            Add or import data
          </h2>
          <p className="pnl-section-lead">
            Choose bulk CSV import for book exports, or log a single expense or sale when something
            happens outside your normal files.
          </p>
          <div className="pnl-data-entry-grid">
            <div
              className="pnl-action-panel pnl-action-panel-books"
              role="group"
              aria-label="Bulk CSV import"
            >
              <div className="pnl-action-panel-heading">
                <h3 className="pnl-action-panel-title">Bulk CSV import</h3>
                <p className="pnl-action-panel-desc">
                  Pull in many rows at once from your accounting export or spreadsheet. Best for
                  historical books and year-over-year comparisons.
                </p>
              </div>
              <div className="pnl-action-panel-buttons">
                <button
                  type="button"
                  className="btn-pnl-upload btn-pnl-upload-expenses"
                  onClick={() => expensesFileRef.current?.click()}
                >
                  Upload Expenses CSV
                </button>
                <input
                  ref={expensesFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCsvFileSelected(file, "expenses");
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className="btn-pnl-upload btn-pnl-upload-sales"
                  onClick={() => salesFileRef.current?.click()}
                >
                  Upload Sales CSV
                </button>
                <input
                  ref={salesFileRef}
                  type="file"
                  accept=".csv,text/csv"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleCsvFileSelected(file, "appointments");
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <div
              className="pnl-action-panel pnl-action-panel-individual"
              role="group"
              aria-label="Log one entry"
            >
              <div className="pnl-action-panel-heading">
                <h3 className="pnl-action-panel-title">Log one entry</h3>
                <p className="pnl-action-panel-desc">
                  Add a single expense or completed sale. Use for day-to-day costs, corrections,
                  merch, or cash. Routine bookings should stay in Porter or your sales CSV.
                </p>
              </div>
              <div className="pnl-individual-buttons">
                <button
                  type="button"
                  className="btn-pnl-log"
                  onClick={() => setExpenseModalOpen(true)}
                >
                  Log Expense
                </button>
                <button
                  type="button"
                  className="btn-pnl-log btn-pnl-log-sale"
                  onClick={() => setSaleModalOpen(true)}
                >
                  Log Sale
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {isManager &&
        (expensesResult || expensesImportError || salesResult || salesImportError) && (
          <div className="pnl-import-result" role="status">
            <h3 className="pnl-import-result-title">Latest CSV import</h3>
            <div className="pnl-import-grid">
              <div>
                <div className="text-muted">Expenses file</div>
                <ImportResultBlock result={expensesResult} error={expensesImportError} />
              </div>
              <div>
                <div className="text-muted">Sales file</div>
                <ImportResultBlock result={salesResult} error={salesImportError} />
              </div>
            </div>
          </div>
        )}

      <section className="pnl-report-section" aria-labelledby="pnl-report-heading">
        <h2 id="pnl-report-heading" className="pnl-section-heading">
          Summary for this period
        </h2>
        <p className="pnl-section-lead">
          Totals below use only appointments and expenses between your start and end dates.
        </p>
        <div className="pnl-date-range date-filters">
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      </section>

      {loading && <p className="text-muted pnl-loading">Loading summary…</p>}
      {pnl && (
        <>
          <div className="pnl-summary-block">
            <div className="kpi-row pnl-kpi-row">
              <div className="kpi-card">
                <div className="kpi-label">Revenue</div>
                <div className="kpi-value">{formatCurrency(pnl.totalRevenue)}</div>
                <p className="kpi-hint">Completed sales in this date range</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Net profit</div>
                <div className={`kpi-value ${pnl.netProfit < 0 ? "negative" : ""}`}>
                  {formatCurrency(pnl.netProfit)}
                </div>
                <p className="kpi-hint">Revenue minus artist payouts and expenses</p>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Margin</div>
                <div className="kpi-value">{formatPercent(pnl.marginPercent)}</div>
                <p className="kpi-hint">Net profit as a share of revenue</p>
              </div>
            </div>
            <div className="pnl-cross-links">
              <Link to="/artists">Artist performance for this period</Link>
              <Link to="/dashboard">Full dashboard KPIs</Link>
            </div>
          </div>

          {Object.keys(pnl.byArtist).length > 0 && (
            <section className="pnl-breakdown-section" aria-labelledby="pnl-artists-heading">
              <h2 id="pnl-artists-heading" className="pnl-section-heading">
                Artist payout breakdown
              </h2>
              <p className="pnl-section-lead">
                Commission tier (60/40 or 70/30) applies per session and may vary. Open an artist
                for the full session list, revenue, and paid tracking.
              </p>
              <ul className="intel-list pnl-breakdown-list">
                {Object.entries(pnl.byArtist).map(([id, line]) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="pnl-artist-row-btn"
                      onClick={() => {
                        setSessionsArtistId(id);
                        setSessionsArtistName(line.artistName);
                      }}
                    >
                      <div className="intel-row-main pnl-artist-row-main">
                        <span className="pnl-artist-name-row">
                          <span className="pnl-artist-name">{line.artistName}</span>
                          <span className="pnl-artist-row-hint">
                            Click name to see detailed list of artist revenue
                          </span>
                        </span>
                        <span className="value-amber">{formatCurrency(line.revenue)}</span>
                      </div>
                      <div className="intel-row-sub">
                        <span>
                          Payout {formatCurrency(line.payout)} ({line.appointmentCount} session
                          {line.appointmentCount === 1 ? "" : "s"})
                        </span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="pnl-breakdown-section" aria-labelledby="pnl-revenue-heading">
            <h2 id="pnl-revenue-heading" className="pnl-section-heading">
              Revenue by service
            </h2>
            <p className="pnl-section-lead">
              How sales split across tattoo, piercing, laser removal, and merchandise for the
              dates above.
            </p>
            <ul className="intel-list pnl-breakdown-list">
              {Object.entries(pnl.byService).length === 0 ? (
                <li className="pnl-breakdown-empty text-muted">
                  No completed sales in this period. Widen the date range or import sales data.
                </li>
              ) : (
                Object.entries(pnl.byService).map(([type, line]) => (
                  <li key={type}>
                    <div className="intel-row-main">
                      <span>{formatServiceType(type)}</span>
                      <span className="value-amber">{formatCurrency(line.revenue)}</span>
                    </div>
                    <div className="intel-row-sub">
                      <span>Shop keeps {formatCurrency(line.profit)}</span>
                      <span>{formatPercent(line.margin)} margin after artist payout</span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="pnl-breakdown-section" aria-labelledby="pnl-expenses-heading">
            <h2 id="pnl-expenses-heading" className="pnl-section-heading">
              Operating expenses
            </h2>
            <p className="pnl-section-lead">
              Costs grouped by category (supplies, rent, utilities, and more) for the same dates.
            </p>
            <ul className="intel-list pnl-breakdown-list">
              {Object.entries(pnl.expensesByCategory).length === 0 ? (
                <li className="pnl-breakdown-empty text-muted">
                  No expenses in this period. Log an expense or import an expenses CSV.
                </li>
              ) : (
                Object.entries(pnl.expensesByCategory).map(([cat, entry]) => (
                  <li key={cat}>
                    <div className="intel-row-main">
                      <span>{cat}</span>
                      <span>{formatCurrency(entry.total)}</span>
                    </div>
                    {entry.items.length > 0 && (
                      <ul className="expense-line-items">
                        {entry.items.map((item, i) => (
                          <li key={i} className="expense-line-item">
                            <span className="expense-line-desc">{item.description}</span>
                            <span className="expense-line-amt">{formatCurrency(item.amount)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))
              )}
            </ul>
          </section>

          {isManager && (
            <section className="pnl-history-section" aria-labelledby="pnl-history-heading">
              <h2 id="pnl-history-heading" className="pnl-section-heading">
                Import history
              </h2>
              <p className="pnl-section-lead">
                Past CSV uploads (filename, row counts, and date). Deleting a row only removes the
                log entry, not the data already imported.
              </p>
              <PnlImportHistory />
            </section>
          )}
        </>
      )}

      {csvMapperOpen && pendingCsv && (
        <CsvColumnMapperModal
          title={pendingCsvFormat === "expenses" ? "Map Expense Columns" : "Map Sales Columns"}
          csv={pendingCsv}
          format={pendingCsvFormat}
          fileName={pendingFileName}
          fields={pendingCsvFormat === "expenses" ? EXPENSE_CSV_FIELDS : APPOINTMENT_CSV_FIELDS}
          onClose={() => {
            setCsvMapperOpen(false);
            setPendingCsv(null);
            setPendingCsvFormat("expenses");
            setPendingFileName(undefined);
          }}
          onImported={handleImportComplete}
        />
      )}

      {expenseModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setExpenseModalOpen(false)}
        >
          <div
            className="kpi-modal expense-modal"
            role="dialog"
            aria-labelledby="expense-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="expense-modal-title">Log an Expense</h2>
            <form onSubmit={(e) => void handleSubmitExpense(e)} className="expense-form">
              <label className="form-field">
                Date
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Vendor
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Amount ($)
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategoryKey)}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Description
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-dark"
                  onClick={() => setExpenseModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-amber" disabled={submitting}>
                  {submitting ? "Saving..." : "Log Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sessionsArtistId && (
        <PnlArtistSessionsDrawer
          artistId={sessionsArtistId}
          artistName={sessionsArtistName}
          start={from}
          end={to}
          onClose={() => {
            setSessionsArtistId(null);
            setSessionsArtistName("");
          }}
        />
      )}

      {saleModalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => setSaleModalOpen(false)}
        >
          <div
            className="kpi-modal expense-modal"
            role="dialog"
            aria-labelledby="sale-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sale-modal-title">Log a Sale</h2>
            <p className="text-muted sale-modal-hint">
              One-off or correction only. Porter and sales CSV remain the main source for
              bookings.
            </p>
            <form onSubmit={(e) => void handleSubmitSale(e)} className="expense-form">
              <label className="form-field">
                Date
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Artist
                <select
                  value={artistId}
                  onChange={(e) => {
                    setArtistId(e.target.value);
                    if (e.target.value !== CUSTOM_ARTIST_VALUE) {
                      setArtistName("");
                    }
                  }}
                  required
                >
                  <option value="" disabled>
                    Select artist
                  </option>
                  {artistOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {!a.isActive ? " (inactive)" : ""}
                    </option>
                  ))}
                  <option value={CUSTOM_ARTIST_VALUE}>Other (type name)</option>
                </select>
              </label>
              {artistId === CUSTOM_ARTIST_VALUE && (
                <label className="form-field">
                  Artist name
                  <input
                    type="text"
                    value={artistName}
                    onChange={(e) => setArtistName(e.target.value)}
                    required
                  />
                </label>
              )}
              <label className="form-field">
                Client name
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Service type
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as SchemaServiceType)}
                >
                  {SERVICE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                Total revenue ($)
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={saleRevenue}
                  onChange={(e) => setSaleRevenue(e.target.value)}
                  required
                />
              </label>
              <label className="form-field">
                Artist payout ($)
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={artistPayout}
                  onChange={(e) => setArtistPayout(e.target.value)}
                  placeholder="Leave blank for shop commission rate"
                />
              </label>
              <label className="form-field">
                Notes
                <textarea
                  rows={2}
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="Optional"
                />
              </label>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-dark"
                  onClick={() => setSaleModalOpen(false)}
                  disabled={saleSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-amber" disabled={saleSubmitting}>
                  {saleSubmitting ? "Saving..." : "Log Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
