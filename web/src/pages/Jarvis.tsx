import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EXPENSE_CATEGORIES, type ExpenseCategoryKey } from "@fallen-sparrow/shared/constants";
import { ExpenseReceiptField } from "@/components/ExpenseReceiptField";
import {
  JarvisResponseRenderer,
  type JarvisIntentResult,
} from "@/components/JarvisResponseRenderer";
import {
  JarvisPayoutProposal,
  type JarvisPayoutProposalData,
} from "@/components/JarvisPayoutProposal";
import { api } from "@/lib/api";
import { emitData, emitJarvisCommitted, DATA_EVENTS } from "@/lib/eventBus";
import { useToast } from "@/context/ToastContext";
import { useIsMobile } from "@/hooks/useMediaQuery";

// ─── API types ───────────────────────────────────────────────────────────────

interface PreviewExpense {
  id: string;
  vendor: string;
  description: string;
  amount: number;
  category: ExpenseCategoryKey;
  date: string;
  confidence: number;
}

interface ReviewExpense extends PreviewExpense {
  receiptUrl: string | null;
  receiptPreview: string | null;
  receiptUploading: boolean;
}

function toReviewExpenses(items: PreviewExpense[]): ReviewExpense[] {
  return items.map((e) => ({
    ...e,
    receiptUrl: null,
    receiptPreview: null,
    receiptUploading: false,
  }));
}

function revokeReceiptPreviews(expenses: ReviewExpense[]): void {
  for (const e of expenses) {
    if (e.receiptPreview) {
      URL.revokeObjectURL(e.receiptPreview);
    }
  }
}

interface PreviewTask {
  id: string;
  description: string;
  taskType: "follow_up" | "staff_note" | "admin";
  dueDate: string | null;
  confidence: number;
}

interface PreviewIncident {
  id: string;
  description: string;
  date: string;
  confidence: number;
}

interface PreviewNote {
  id: string;
  content: string;
  confidence: number;
}

interface PreviewSuggestion {
  id: string;
  rawText: string;
  parsedAs: string;
  reason: string;
}

interface JarvisPreview {
  type?: "query_response" | "command_response" | "log_items" | "payout_proposal";
  intent?: "QUERY" | "COMMAND" | "LOG";
  confidence?: number;
  message?: string;
  requiresApproval?: boolean;
  expenses: PreviewExpense[];
  tasks: PreviewTask[];
  incidents: PreviewIncident[];
  notes: PreviewNote[];
  suggestions: PreviewSuggestion[];
  payoutProposal?: JarvisPayoutProposalData;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORIES).map(([key, meta]) => ({
  key: key as ExpenseCategoryKey,
  label: meta.name,
}));

const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow up",
  staff_note: "Staff note",
  admin: "Admin",
};

function formatJarvisError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "Request failed";
  if (msg.includes("ANTHROPIC_API_KEY")) {
    return "AI not configured. Add ANTHROPIC_API_KEY to .env and restart the API server.";
  }
  if (msg.includes("Brain dump parse failed") || msg.includes("ZodError") || msg.startsWith("[")) {
    return "JARVIS could not read that update. Try shorter chunks or be more specific about amounts and dates.";
  }
  return msg;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

type ReviewSectionVariant = "expenses" | "tasks" | "incidents" | "notes" | "miscellaneous";

function ReviewSectionHeader({
  variant,
  title,
  count,
}: {
  variant: ReviewSectionVariant;
  title: string;
  count: number;
}) {
  return (
    <h3 className={`jrv-section-title jrv-section-${variant}`}>
      <span className="jrv-section-title-text">{title}</span>
      <span className="jrv-section-count">{count}</span>
    </h3>
  );
}

function FieldLabel({ children, htmlFor }: { children: string; htmlFor?: string }) {
  return (
    <label className="jrv-field-label" htmlFor={htmlFor}>
      {children}
    </label>
  );
}

function RemoveItemButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="jrv-remove" aria-label={label} onClick={onClick}>
      <TrashIcon />
    </button>
  );
}

function JarvisHelpChevron() {
  return (
    <svg
      className="jarvis-help-chevron"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function JarvisHelpSummary() {
  return (
    <>
      <span className="jarvis-help-summary-text">
        <span className="jarvis-help-label-closed">How to use JARVIS</span>
        <span className="jarvis-help-label-open">Hide instructions</span>
      </span>
      <JarvisHelpChevron />
    </>
  );
}

export function JarvisHistorySummary() {
  return (
    <>
      <span className="jarvis-help-summary-text">
        <span className="jarvis-help-label-closed">Request history</span>
        <span className="jarvis-help-label-open">Hide history</span>
      </span>
      <JarvisHelpChevron />
    </>
  );
}

type JarvisHistoryIntent = "LOG" | "QUERY" | "COMMAND";

interface JarvisHistoryItem {
  id: string;
  rawInput: string;
  intent: JarvisHistoryIntent;
  inputType: string;
  responsePreview: string | null;
  createdAt: string;
}

function truncateDisplay(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatHistoryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function intentBadgeClass(intent: JarvisHistoryIntent): string {
  if (intent === "QUERY") return "jarvis-history-intent jarvis-history-intent-query";
  if (intent === "COMMAND") return "jarvis-history-intent jarvis-history-intent-command";
  return "jarvis-history-intent jarvis-history-intent-log";
}

export function JarvisRequestHistory({
  refreshKey = 0,
  detailsClassName = "jarvis-history-details jarvis-help-details",
}: {
  refreshKey?: number;
  detailsClassName?: string;
}) {
  const { showToast } = useToast();
  const [items, setItems] = useState<JarvisHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ requests: JarvisHistoryItem[] }>("/api/jarvis/history");
      setItems(res.requests);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshKey]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const prev = items;
    setItems((current) => current.filter((row) => row.id !== id));
    try {
      await api.delete(`/api/jarvis/history/${id}`);
      showToast("Removed from history", "success");
    } catch (err) {
      setItems(prev);
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (items.length === 0 || clearing) return;
    setClearing(true);
    try {
      await api.delete("/api/jarvis/history");
      setItems([]);
      showToast("History cleared", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Clear failed", "error");
    } finally {
      setClearing(false);
    }
  };

  return (
    <details className={detailsClassName}>
      <summary className="jarvis-help-summary">
        <JarvisHistorySummary />
      </summary>
      <div className="jarvis-history">
        {loading ? (
          <p className="jarvis-history-empty text-muted">Loading history…</p>
        ) : items.length === 0 ? (
          <p className="jarvis-history-empty text-muted">No requests yet.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <div className="jarvis-history-row-main">
                  <div className="jarvis-history-row-top">
                    <time dateTime={item.createdAt}>{formatHistoryTime(item.createdAt)}</time>
                    <span className={intentBadgeClass(item.intent)}>{item.intent}</span>
                  </div>
                  <span className="jarvis-history-raw" title={item.rawInput}>
                    {truncateDisplay(item.rawInput, 120)}
                  </span>
                  {item.responsePreview ? (
                    <span className="jarvis-history-preview" title={item.responsePreview}>
                      {truncateDisplay(item.responsePreview, 160)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="jarvis-history-delete"
                  aria-label="Delete history entry"
                  disabled={deletingId === item.id}
                  onClick={() => void handleDelete(item.id)}
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!loading && items.length > 0 ? (
          <div className="jarvis-history-footer">
            <button
              type="button"
              className="btn-dark btn-sm jarvis-history-clear"
              disabled={clearing}
              onClick={() => void handleClearAll()}
            >
              {clearing ? "Clearing…" : "Clear all"}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}

function JarvisUsageGuide() {
  return (
    <details className="jarvis-guide jarvis-help-details">
      <summary className="jarvis-help-summary">
        <JarvisHelpSummary />
      </summary>
      <div className="jarvis-guide-body">
      <p className="jarvis-guide-lead text-muted">
        Type your message. Plain language is best. JARVIS picks one of three paths: log it, answer
        from shop data, or run a command.
      </p>

      <div className="jarvis-guide-section">
        <h3 className="jarvis-guide-heading">Log (file something)</h3>
        <ul className="jarvis-guide-list">
          <li>
            Expenses, incidents, tasks, inventory updates, and strategic notes. One message can include
            several items.
          </li>
          <li>Include amounts and dates when you know them.</li>
          <li>
            Broken AC or equipment problems are <strong>Incidents / Maintenance</strong>. Follow-ups and
            supply orders are <strong>Tasks</strong>.
          </li>
          <li>You always <strong>review and approve</strong> before anything is saved.</li>
          <li>
            <strong>Artist payouts</strong> (owners/managers): say who you paid, how much, and how (Cash,
            Zelle, or Cash App). JARVIS matches unpaid sessions and you confirm with one button.
          </li>
        </ul>
        <p className="jarvis-guide-examples-text text-muted">
          Examples: &quot;Paid $340 to fix the back sink yesterday.&quot; · &quot;Paid Carlos $5376 via Zelle.&quot; ·
          &quot;Follow up with Marcus about his deposit.&quot;
        </p>
      </div>

      <div className="jarvis-guide-section">
        <h3 className="jarvis-guide-heading">Query (ask a question)</h3>
        <ul className="jarvis-guide-list">
          <li>JARVIS reads your real numbers and answers in bullet points.</li>
          <li>No review step. The answer appears right away.</li>
        </ul>
        <p className="jarvis-guide-examples-text text-muted">
          Examples: &quot;Give me a recap of May.&quot; · &quot;How did we do last week?&quot; ·
          &quot;What expenses did we have this month?&quot; · &quot;What SOPs were missed yesterday?&quot; ·
          &quot;What follow-ups are due?&quot; · &quot;Give me a business health check.&quot;
        </p>
      </div>

      <div className="jarvis-guide-section">
        <h3 className="jarvis-guide-heading">Command (do something)</h3>
        <ul className="jarvis-guide-list">
          <li>Change a team member PIN, add someone to a role, or deactivate an employee.</li>
          <li>Runs immediately. JARVIS confirms when it is done (PIN changes are reset only, not revealed).</li>
        </ul>
        <p className="jarvis-guide-examples-text text-muted">
          Examples: &quot;Change Courtney&apos;s PIN to 5555.&quot; · &quot;Add Sarah to front desk.&quot; ·
          &quot;Deactivate Marcus.&quot;
        </p>
      </div>

      <div className="jarvis-guide-section">
        <h3 className="jarvis-guide-heading">After you send a log</h3>
        <ol className="jarvis-guide-list jarvis-guide-steps">
          <li>
            <strong>Review screen</strong>: items grouped into Expenses, Tasks, Incidents / Maintenance,
            Strategic Notes, and sometimes items that need a second look.
          </li>
          <li>
            <strong>Edit or remove</strong> anything wrong. Add an optional receipt photo on expenses.
          </li>
          <li>
            <strong>Approve</strong>: saved items go to P&amp;L, Tasks, Incidents, Inventory, and Notes.
          </li>
        </ol>
      </div>
      </div>
    </details>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function JarvisPage() {
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  // Input stage state
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  // Review stage state
  const [stage, setStage] = useState<"input" | "review">("input");
  const [rawSnapshot, setRawSnapshot] = useState("");
  const [reviewExpenses, setReviewExpenses] = useState<ReviewExpense[]>([]);
  const [reviewTasks, setReviewTasks] = useState<PreviewTask[]>([]);
  const [reviewIncidents, setReviewIncidents] = useState<PreviewIncident[]>([]);
  const [reviewNotes, setReviewNotes] = useState<PreviewNote[]>([]);
  const [reviewSuggestions, setReviewSuggestions] = useState<PreviewSuggestion[]>([]);
  const [approving, setApproving] = useState(false);
  const [pendingSuggestions, setPendingSuggestions] = useState(0);
  const [intentResult, setIntentResult] = useState<JarvisIntentResult | null>(null);
  const [payoutProposal, setPayoutProposal] = useState<JarvisPayoutProposalData | null>(null);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const loadPendingSuggestions = useCallback(async () => {
    try {
      const res = await api.get<{ suggestions: unknown[] }>("/api/jarvis/suggestions");
      setPendingSuggestions(res.suggestions.length);
    } catch {
      setPendingSuggestions(0);
    }
  }, []);

  useEffect(() => {
    void loadPendingSuggestions();
  }, [loadPendingSuggestions]);

  // ── Submit: call /preview, enter review stage ─────────────────────────────

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    setIntentResult(null);
    setPayoutProposal(null);
    try {
      const preview = await api.post<
        JarvisPreview & {
          teamCommand?: { action: string; message: string; pin?: string };
        }
      >("/api/jarvis/preview", {
        rawText: inputText.trim(),
      });
      if (preview.type === "payout_proposal" && preview.payoutProposal) {
        setPayoutProposal(preview.payoutProposal);
        setInputText("");
        setHistoryRefreshKey((k) => k + 1);
        if (isMobile && navigator.vibrate) navigator.vibrate(30);
        return;
      }
      if (
        preview.type === "query_response" ||
        preview.type === "command_response"
      ) {
        setIntentResult({
          type: preview.type,
          intent: preview.intent === "COMMAND" ? "COMMAND" : "QUERY",
          confidence: preview.confidence ?? 1,
          message: preview.message,
          requiresApproval: false,
          subType: undefined,
        });
        setInputText("");
        setHistoryRefreshKey((k) => k + 1);
        if (isMobile && navigator.vibrate) navigator.vibrate(30);
        return;
      }
      if (preview.teamCommand) {
        showToast(preview.teamCommand.message, "success");
        emitData(DATA_EVENTS.sops);
        setInputText("");
        setHistoryRefreshKey((k) => k + 1);
        if (isMobile && navigator.vibrate) navigator.vibrate(30);
        return;
      }
      setRawSnapshot(inputText.trim());
      setReviewExpenses(toReviewExpenses(preview.expenses));
      setReviewTasks(preview.tasks);
      setReviewIncidents(preview.incidents);
      setReviewNotes(preview.notes);
      setReviewSuggestions(preview.suggestions);
      setStage("review");
      setHistoryRefreshKey((k) => k + 1);
      if (isMobile && navigator.vibrate) navigator.vibrate(30);
    } catch (err) {
      const msg = formatJarvisError(err);
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Approve: commit edited items ──────────────────────────────────────────

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await api.post<{
        committed: {
          expenses: number;
          tasks: number;
          incidents: number;
          notes: number;
          inventoryUpdates: number;
        };
      }>(
        "/api/jarvis/approve",
        {
          rawText: rawSnapshot,
          expenses: reviewExpenses.map(({ description, amount, category, date }) => ({
            description,
            amount,
            category,
            date,
          })),
          tasks: reviewTasks.map(({ description, taskType, dueDate }) => ({
            description,
            taskType,
            dueDate: dueDate || null,
          })),
          incidents: reviewIncidents.map(({ description, date }) => ({ description, date })),
          notes: reviewNotes.map(({ content }) => ({ content })),
        },
      );

      const c = res.committed;
      const parts: string[] = [];
      if (c.expenses) parts.push(`${c.expenses} expense${c.expenses === 1 ? "" : "s"}`);
      if (c.incidents) parts.push(`${c.incidents} incident${c.incidents === 1 ? "" : "s"}`);
      if (c.tasks) parts.push(`${c.tasks} task${c.tasks === 1 ? "" : "s"}`);
      if (c.notes) parts.push(`${c.notes} note${c.notes === 1 ? "" : "s"}`);

      showToast(parts.length ? `Logged: ${parts.join(" · ")}` : "Nothing to log", "success");
      emitJarvisCommitted(c);
      if (reviewSuggestions.length > 0) {
        emitData(DATA_EVENTS.tasks);
      }
      void loadPendingSuggestions();
      revokeReceiptPreviews(reviewExpenses);
      setReviewExpenses([]);
      setReviewSuggestions([]);
      setInputText("");
      setStage("input");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approval failed", "error");
    } finally {
      setApproving(false);
    }
  };

  const handleDiscard = () => {
    revokeReceiptPreviews(reviewExpenses);
    setReviewExpenses([]);
    setStage("input");
    setIntentResult(null);
  };

  const uploadReceiptForExpense = async (index: number, file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setReviewExpenses((prev) =>
      prev.map((e, idx) =>
        idx === index
          ? {
              ...e,
              receiptPreview: previewUrl,
              receiptUploading: true,
            }
          : e,
      ),
    );

    try {
      const formData = new FormData();
      formData.append("receipt", file);
      const res = await api.upload<{ receiptUrl: string }>("/api/jarvis/receipt", formData);
      setReviewExpenses((prev) =>
        prev.map((e, idx) => {
          if (idx !== index) return e;
          if (e.receiptPreview && e.receiptPreview !== previewUrl) {
            URL.revokeObjectURL(e.receiptPreview);
          }
          return {
            ...e,
            receiptUrl: res.receiptUrl,
            receiptPreview: previewUrl,
            receiptUploading: false,
          };
        }),
      );
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      setReviewExpenses((prev) =>
        prev.map((e, idx) =>
          idx === index
            ? { ...e, receiptPreview: null, receiptUploading: false }
            : e,
        ),
      );
      showToast(err instanceof Error ? err.message : "Receipt upload failed", "error");
    }
  };

  const removeReceiptForExpense = (index: number) => {
    setReviewExpenses((prev) =>
      prev.map((e, idx) => {
        if (idx !== index) return e;
        if (e.receiptPreview) URL.revokeObjectURL(e.receiptPreview);
        return {
          ...e,
          receiptUrl: null,
          receiptPreview: null,
          receiptUploading: false,
        };
      }),
    );
  };

  // ── Field updaters ────────────────────────────────────────────────────────

  function updateExpense<K extends keyof ReviewExpense>(i: number, key: K, val: ReviewExpense[K]) {
    setReviewExpenses((prev) => prev.map((e, idx) => idx === i ? { ...e, [key]: val } : e));
  }

  function updateTask<K extends keyof PreviewTask>(i: number, key: K, val: PreviewTask[K]) {
    setReviewTasks((prev) => prev.map((t, idx) => idx === i ? { ...t, [key]: val } : t));
  }

  function updateIncident<K extends keyof PreviewIncident>(i: number, key: K, val: PreviewIncident[K]) {
    setReviewIncidents((prev) => prev.map((inc, idx) => idx === i ? { ...inc, [key]: val } : inc));
  }

  function updateNote(i: number, content: string) {
    setReviewNotes((prev) => prev.map((n, idx) => idx === i ? { ...n, content } : n));
  }

  const totalToCommit =
    reviewExpenses.length + reviewTasks.length + reviewIncidents.length + reviewNotes.length;

  // ── Review panel ──────────────────────────────────────────────────────────

  const reviewPanel = (
    <div className="jarvis-review-panel">
      <div className="jarvis-review-header">
        <h2>Review before logging</h2>
        <p className="text-muted">
          {totalToCommit === 0 && reviewSuggestions.length === 0
            ? "Nothing actionable found in that update."
            : `${totalToCommit} item${totalToCommit === 1 ? "" : "s"} ready to log. Edit or remove as needed.`}
        </p>
      </div>

      {reviewExpenses.length > 0 && (
        <section className="jrv-section jrv-section-block-expenses">
          <ReviewSectionHeader variant="expenses" title="Expenses" count={reviewExpenses.length} />
          <ul className="jrv-list">
            {reviewExpenses.map((e, i) => (
              <li key={e.id} className="jrv-item jrv-item-expense">
                <div className="jrv-item-main">
                  <FieldLabel htmlFor={`exp-desc-${e.id}`}>What was purchased</FieldLabel>
                  <input
                    id={`exp-desc-${e.id}`}
                    className="jrv-input jrv-input-primary"
                    value={e.description}
                    onChange={(ev) => updateExpense(i, "description", ev.target.value)}
                    placeholder="Description"
                  />
                  <div className="jrv-meta-row">
                    <div className="jrv-field">
                      <FieldLabel htmlFor={`exp-cat-${e.id}`}>Category</FieldLabel>
                      <select
                        id={`exp-cat-${e.id}`}
                        className="jrv-select jrv-select-category"
                        value={e.category}
                        onChange={(ev) =>
                          updateExpense(i, "category", ev.target.value as ExpenseCategoryKey)
                        }
                      >
                        {CATEGORY_OPTIONS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="jrv-field jrv-field-narrow">
                      <FieldLabel htmlFor={`exp-amt-${e.id}`}>Amount</FieldLabel>
                      <div className="jrv-amount-wrap">
                        <span className="jrv-amount-prefix" aria-hidden>
                          $
                        </span>
                        <input
                          id={`exp-amt-${e.id}`}
                          className="jrv-input jrv-input-amount"
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={e.amount}
                          onChange={(ev) => updateExpense(i, "amount", Number(ev.target.value))}
                        />
                      </div>
                    </div>
                    <div className="jrv-field jrv-field-narrow">
                      <FieldLabel htmlFor={`exp-date-${e.id}`}>Date</FieldLabel>
                      <input
                        id={`exp-date-${e.id}`}
                        className="jrv-input"
                        type="date"
                        value={e.date}
                        onChange={(ev) => updateExpense(i, "date", ev.target.value)}
                      />
                    </div>
                  </div>
                  <ExpenseReceiptField
                    receiptUrl={e.receiptUrl}
                    receiptPreview={e.receiptPreview}
                    uploading={e.receiptUploading}
                    onSelectFile={(file) => void uploadReceiptForExpense(i, file)}
                    onRemove={() => removeReceiptForExpense(i)}
                  />
                </div>
                <RemoveItemButton
                  label="Remove expense"
                  onClick={() => {
                    if (e.receiptPreview) URL.revokeObjectURL(e.receiptPreview);
                    setReviewExpenses((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewTasks.length > 0 && (
        <section className="jrv-section jrv-section-block-tasks">
          <ReviewSectionHeader variant="tasks" title="Tasks" count={reviewTasks.length} />
          <ul className="jrv-list">
            {reviewTasks.map((t, i) => (
              <li key={t.id} className="jrv-item jrv-item-task">
                <div className="jrv-item-main">
                  <FieldLabel htmlFor={`task-desc-${t.id}`}>Task</FieldLabel>
                  <input
                    id={`task-desc-${t.id}`}
                    className="jrv-input jrv-input-primary"
                    value={t.description}
                    onChange={(ev) => updateTask(i, "description", ev.target.value)}
                    placeholder="What needs to happen"
                  />
                  <div className="jrv-meta-row">
                    <div className="jrv-field">
                      <FieldLabel htmlFor={`task-type-${t.id}`}>Type</FieldLabel>
                      <select
                        id={`task-type-${t.id}`}
                        className="jrv-select jrv-select-category"
                        value={t.taskType}
                        onChange={(ev) =>
                          updateTask(i, "taskType", ev.target.value as PreviewTask["taskType"])
                        }
                      >
                        {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="jrv-field jrv-field-narrow">
                      <FieldLabel htmlFor={`task-due-${t.id}`}>Due date</FieldLabel>
                      <input
                        id={`task-due-${t.id}`}
                        className="jrv-input"
                        type="date"
                        value={t.dueDate ?? ""}
                        onChange={(ev) => updateTask(i, "dueDate", ev.target.value || null)}
                      />
                    </div>
                  </div>
                </div>
                <RemoveItemButton
                  label="Remove task"
                  onClick={() => setReviewTasks((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewIncidents.length > 0 && (
        <section className="jrv-section jrv-section-block-incidents">
          <ReviewSectionHeader
            variant="incidents"
            title="Incidents / Maintenance"
            count={reviewIncidents.length}
          />
          <p className="jrv-section-hint text-muted">
            Mechanical and functional shop issues: HVAC, plumbing, equipment, and facility problems.
          </p>
          <ul className="jrv-list">
            {reviewIncidents.map((inc, i) => (
              <li key={inc.id} className="jrv-item jrv-item-incident">
                <div className="jrv-item-main">
                  <FieldLabel htmlFor={`inc-desc-${inc.id}`}>Issue</FieldLabel>
                  <input
                    id={`inc-desc-${inc.id}`}
                    className="jrv-input jrv-input-primary"
                    value={inc.description}
                    onChange={(ev) => updateIncident(i, "description", ev.target.value)}
                    placeholder="What happened"
                  />
                  <div className="jrv-meta-row">
                    <div className="jrv-field jrv-field-narrow">
                      <FieldLabel htmlFor={`inc-date-${inc.id}`}>Occurred</FieldLabel>
                      <input
                        id={`inc-date-${inc.id}`}
                        className="jrv-input"
                        type="date"
                        value={inc.date}
                        onChange={(ev) => updateIncident(i, "date", ev.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <RemoveItemButton
                  label="Remove incident"
                  onClick={() => setReviewIncidents((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewNotes.length > 0 && (
        <section className="jrv-section jrv-section-block-notes">
          <ReviewSectionHeader variant="notes" title="Strategic Notes" count={reviewNotes.length} />
          <ul className="jrv-list">
            {reviewNotes.map((n, i) => (
              <li key={n.id} className="jrv-item jrv-item-note">
                <div className="jrv-item-main">
                  <FieldLabel htmlFor={`note-${n.id}`}>Note</FieldLabel>
                  <textarea
                    id={`note-${n.id}`}
                    className="jrv-input jrv-input-primary jrv-textarea"
                    rows={Math.max(4, Math.min(14, n.content.split("\n").length + 2))}
                    value={n.content}
                    onChange={(ev) => updateNote(i, ev.target.value)}
                  />
                </div>
                <RemoveItemButton
                  label="Remove note"
                  onClick={() => setReviewNotes((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewSuggestions.length > 0 && (
        <section className="jrv-section jrv-section-block-miscellaneous">
          <ReviewSectionHeader
            variant="miscellaneous"
            title="Miscellaneous"
            count={reviewSuggestions.length}
          />
          <p className="jrv-section-hint text-muted">
            Items JARVIS could not sort into a category. Remove or edit your brain dump and try again.
          </p>
          <ul className="jrv-list">
            {reviewSuggestions.map((s, i) => (
              <li key={s.id} className="jrv-item jrv-item-suggestion">
                <div className="jrv-item-main">
                  <p className="jrv-suggestion-text">{s.rawText}</p>
                  <p className="jrv-suggestion-reason">{s.reason}</p>
                </div>
                <RemoveItemButton
                  label="Dismiss suggestion"
                  onClick={() => setReviewSuggestions((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="jrv-actions">
        <button type="button" className="btn-dark" onClick={handleDiscard} disabled={approving}>
          Discard
        </button>
        <button
          type="button"
          className={`btn-amber${approving ? " jarvis-send-loading" : ""}`}
          disabled={
            approving ||
            totalToCommit === 0 ||
            reviewExpenses.some((e) => e.receiptUploading)
          }
          onClick={() => void handleApprove()}
        >
          {approving
            ? "Logging..."
            : totalToCommit > 0
              ? `Approve (${totalToCommit})`
              : "Nothing to approve"}
        </button>
      </div>
    </div>
  );

  // ── Input panel ───────────────────────────────────────────────────────────

  const inputPanel = (
    <div className="jarvis-input-panel">
      <JarvisUsageGuide />
      <JarvisRequestHistory refreshKey={historyRefreshKey} />
      <form onSubmit={(e) => void handleSubmit(e)} className="jarvis-form">
        <label className="jarvis-form-label" htmlFor="jarvis-brain-dump">
          Your update
        </label>
        <textarea
          id="jarvis-brain-dump"
          className="jarvis-input brain-dump-input"
          rows={isMobile ? 5 : 7}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Log: Paid $85 for gloves yesterday. Query: Give me a recap of May. Command: Change Courtney's PIN to 5555."
        />
        <button
          type="submit"
          className={`btn-amber jarvis-send${loading ? " jarvis-send-loading" : ""}`}
          disabled={loading || !inputText.trim()}
        >
          {loading ? "JARVIS is sorting your update..." : "Send to JARVIS"}
        </button>
      </form>
      {payoutProposal ? (
        <JarvisPayoutProposal
          proposal={payoutProposal}
          onConfirmed={(msg) => {
            setPayoutProposal(null);
            setIntentResult({
              type: "query_response",
              intent: "QUERY",
              confidence: 1,
              message: msg,
              requiresApproval: false,
            });
            emitData(DATA_EVENTS.appointments);
            showToast("Artist payout recorded", "success");
            setHistoryRefreshKey((k) => k + 1);
          }}
          onDismiss={() => setPayoutProposal(null)}
        />
      ) : null}
      {intentResult && !payoutProposal ? <JarvisResponseRenderer result={intentResult} /> : null}
    </div>
  );

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <div
      className={`page jarvis-page${isMobile ? " jarvis-mobile" : " jarvis-desktop"}${stage === "review" ? " jarvis-page-review" : ""}`}
    >
      <header className="jarvis-header">
        <div>
          <h1 className="jarvis-title">JARVIS</h1>
          <p className="jarvis-subtitle text-muted">Fallen Sparrow Operations</p>
          {pendingSuggestions > 0 && (
            <Link to="/jarvis#suggestions" className="jarvis-suggestions-link">
              {pendingSuggestions} item{pendingSuggestions === 1 ? "" : "s"} need your review
            </Link>
          )}
        </div>
      </header>

      <div
        className={`jarvis-layout${stage === "review" ? " jarvis-layout-review" : " jarvis-layout-input"}`}
      >
        {stage === "review" ? reviewPanel : inputPanel}
      </div>

      {stage === "input" && pendingSuggestions > 0 && (
        <JarvisPendingSuggestions onChanged={() => void loadPendingSuggestions()} />
      )}
    </div>
  );
}

interface PendingSuggestionRow {
  id: string;
  rawText: string;
  proposedType: string | null;
  createdAt: string;
}

function JarvisPendingSuggestions({ onChanged }: { onChanged: () => void }) {
  const { showToast } = useToast();
  const [rows, setRows] = useState<PendingSuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ suggestions: PendingSuggestionRow[] }>("/api/jarvis/suggestions");
      setRows(res.suggestions);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dismiss = async (id: string) => {
    try {
      await api.delete(`/api/jarvis/suggestions/${id}`);
      showToast("Suggestion dismissed", "success");
      await load();
      onChanged();
      emitData(DATA_EVENTS.tasks);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Dismiss failed", "error");
    }
  };

  if (loading || rows.length === 0) return null;

  return (
    <section id="suggestions" className="jarvis-pending-suggestions">
      <h2>Pending review ({rows.length})</h2>
      <ul className="jrv-list">
        {rows.map((row) => (
          <li key={row.id} className="jrv-item jrv-item-suggestion">
            <div className="jrv-item-main">
              <p className="jrv-suggestion-text">{row.rawText}</p>
              {row.proposedType && (
                <p className="jrv-suggestion-reason text-muted">Type: {row.proposedType}</p>
              )}
            </div>
            <button
              type="button"
              className="btn-dark btn-sm"
              onClick={() => void dismiss(row.id)}
            >
              Dismiss
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
