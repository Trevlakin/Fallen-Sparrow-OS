import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { useIsOwner } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { DATA_EVENTS } from "@/lib/eventBus";
import { EmptyState } from "@/components/EmptyState";
import {
  checklistBorderClass,
  formatChecklistTime,
  todayISO,
} from "@/lib/checklistApi";

interface SopItem {
  id: string;
  label: string;
  sortOrder: number | null;
}

interface Sop {
  id: string;
  title: string;
  role: "OWNER" | "MANAGER" | "FRONT_DESK" | "ARTIST" | null;
  frequency: string | null;
  isActive: boolean | null;
  items: SopItem[];
}

interface StatusRow {
  sopId: string;
  sopTitle: string;
  role: string | null;
  roleLabel: string;
  totalItems: number;
  completedToday: number;
  pct: number;
  lastActivity: string | null;
}

interface DetailItem {
  itemId: string;
  label: string;
  completed: boolean;
  completedAt: string | null;
  completedByLabel: string | null;
}

interface AccessCode {
  id: string;
  label: string;
  accessToken: string;
  pin: string | null;
  sopId: string;
  sopTitle: string;
  isActive: boolean | null;
  lastUsedAt: string | null;
  createdAt: string | null;
}

type SopRoleOption = "OWNER" | "MANAGER" | "FRONT_DESK" | "ARTIST" | "CLEANER";

const ROLE_OPTIONS: SopRoleOption[] = [
  "OWNER",
  "MANAGER",
  "FRONT_DESK",
  "ARTIST",
  "CLEANER",
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "per_session", label: "Per Session" },
];

function roleBadgeLabel(role: SopRoleOption | null): string {
  if (!role || role === "CLEANER") return "CLEANER";
  return role.replace(/_/g, " ");
}

function sopToFormRole(role: Sop["role"]): SopRoleOption {
  if (!role) return "CLEANER";
  return role;
}

export function OperationsPage() {
  const isOwner = useIsOwner();
  const { showToast } = useToast();
  const [tab, setTab] = useState<"status" | "manage">("status");
  const [sessionDate, setSessionDate] = useState(todayISO());
  const [statuses, setStatuses] = useState<StatusRow[]>([]);
  const [expandedSopId, setExpandedSopId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<DetailItem[]>([]);
  const [sops, setSops] = useState<Sop[]>([]);
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [accessModalOpen, setAccessModalOpen] = useState(false);
  const [accessResult, setAccessResult] = useState<{
    pin: string;
    accessToken: string;
    qrUrl: string;
  } | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formRole, setFormRole] = useState<SopRoleOption>("FRONT_DESK");
  const [formFrequency, setFormFrequency] = useState("daily");
  const [formItems, setFormItems] = useState<{ label: string; sortOrder: number }[]>([
    { label: "", sortOrder: 0 },
  ]);
  const [accessLabel, setAccessLabel] = useState("");
  const [accessSopId, setAccessSopId] = useState("");

  const loadStatus = useCallback(async () => {
    const res = await api.get<{ statuses: StatusRow[] }>(
      `/api/sops/status/today?sessionDate=${sessionDate}`,
    );
    setStatuses(res.statuses.filter((s) => s.totalItems > 0));
  }, [sessionDate]);

  const loadManage = useCallback(async () => {
    if (!isOwner) return;
    const [sopRes, accessRes] = await Promise.all([
      api.get<{ sops: Sop[] }>("/api/sops"),
      api.get<{ accessCodes: AccessCode[] }>("/api/sops/access"),
    ]);
    setSops(sopRes.sops.filter((s) => s.isActive !== false));
    setAccessCodes(accessRes.accessCodes.filter((a) => a.isActive !== false));
  }, [isOwner]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadStatus();
      if (isOwner) {
        await loadManage();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load", "error");
    } finally {
      setLoading(false);
    }
  }, [isOwner, loadManage, loadStatus, showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEventBusRefresh([DATA_EVENTS.sops], loadAll);

  const toggleExpand = async (sopId: string) => {
    if (expandedSopId === sopId) {
      setExpandedSopId(null);
      setExpandedItems([]);
      return;
    }
    try {
      const res = await api.get<{ items: DetailItem[] }>(
        `/api/sops/${sopId}/detail?sessionDate=${sessionDate}`,
      );
      setExpandedSopId(sopId);
      setExpandedItems(res.items);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load items", "error");
    }
  };

  const openCreateModal = () => {
    setEditingSop(null);
    setFormTitle("");
    setFormRole("FRONT_DESK");
    setFormFrequency("daily");
    setFormItems([{ label: "", sortOrder: 0 }]);
    setModalOpen(true);
  };

  const openEditModal = (sop: Sop) => {
    setEditingSop(sop);
    setFormTitle(sop.title);
    setFormRole(sopToFormRole(sop.role));
    setFormFrequency(sop.frequency ?? "daily");
    setFormItems(
      sop.items.map((item, idx) => ({
        label: item.label,
        sortOrder: item.sortOrder ?? idx,
      })),
    );
    setModalOpen(true);
  };

  const handleSaveSop = async () => {
    const items = formItems
      .filter((i) => i.label.trim())
      .map((item, idx) => ({ label: item.label.trim(), sortOrder: idx }));
    if (!formTitle.trim() || items.length === 0) {
      showToast("Title and at least one step required", "error");
      return;
    }
    const payload = {
      title: formTitle.trim(),
      role: formRole === "CLEANER" ? "CLEANER" : formRole,
      frequency: formFrequency,
      items,
    };
    try {
      if (editingSop) {
        await api.put(`/api/sops/${editingSop.id}`, payload);
      } else {
        await api.post("/api/sops", payload);
      }
      setModalOpen(false);
      await loadAll();
      showToast(editingSop ? "SOP updated" : "SOP created", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    }
  };

  const deleteSop = async (sop: Sop) => {
    if (!window.confirm(`Deactivate "${sop.title}"?`)) return;
    try {
      await api.delete(`/api/sops/${sop.id}`);
      await loadAll();
      showToast("SOP deactivated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  const createAccess = async () => {
    if (!accessLabel.trim() || !accessSopId) {
      showToast("Label and SOP required", "error");
      return;
    }
    try {
      const res = await api.post<{
        pin: string;
        accessToken: string;
        qrUrl: string;
      }>("/api/sops/access", {
        label: accessLabel.trim(),
        sopId: accessSopId,
      });
      setAccessResult(res);
      setAccessModalOpen(false);
      setAccessLabel("");
      await loadManage();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create code", "error");
    }
  };

  const revokeAccess = async (id: string) => {
    if (!window.confirm("Revoke this access code?")) return;
    try {
      await api.delete(`/api/sops/access/${id}`);
      await loadManage();
      showToast("Access code revoked", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Revoke failed", "error");
    }
  };

  const checklistUrl = useMemo(() => {
    if (!accessResult) return "";
    const origin = window.location.origin;
    return `${origin}${accessResult.qrUrl}`;
  }, [accessResult]);

  useEffect(() => {
    if (!accessResult || !qrCanvasRef.current) return;
    void QRCode.toCanvas(qrCanvasRef.current, checklistUrl, {
      width: 220,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }, [accessResult, checklistUrl]);

  const moveItem = (index: number, direction: -1 | 1) => {
    const next = [...formItems];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    const temp = next[index];
    const swap = next[target];
    if (!temp || !swap) return;
    next[index] = swap;
    next[target] = temp;
    setFormItems(next.map((item, idx) => ({ ...item, sortOrder: idx })));
  };

  return (
    <div className="page operations-page">
      <header className="operations-header">
        <div>
          <span className="wordmark-sm">FALLEN SPARROW</span>
          <h1>Operations</h1>
        </div>
        {isOwner && tab === "manage" && (
          <button type="button" className="btn-amber" onClick={openCreateModal}>
            Create New SOP
          </button>
        )}
      </header>

      <div className="operations-tabs">
        <button
          type="button"
          className={tab === "status" ? "active" : ""}
          onClick={() => setTab("status")}
        >
          Today&apos;s Status
        </button>
        {isOwner && (
          <button
            type="button"
            className={tab === "manage" ? "active" : ""}
            onClick={() => setTab("manage")}
          >
            Manage SOPs
          </button>
        )}
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {!loading && tab === "status" && (
        <section className="operations-status">
          <label className="operations-date-picker">
            <span>Date</span>
            <input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </label>

          {statuses.length === 0 && (
            <EmptyState
              icon="📋"
              title="No checklists yet"
              description="Create your first SOP to track daily routines for your team."
              ctaLabel={isOwner ? "Create checklist" : undefined}
              onCtaClick={isOwner ? () => setTab("manage") : undefined}
            />
          )}

          {statuses.map((row) => {
            const border = checklistBorderClass(row.pct, row.completedToday);
            return (
              <article
                key={row.sopId}
                className={`sop-status-card sop-border-${border}`}
              >
                <button
                  type="button"
                  className="sop-status-head"
                  onClick={() => void toggleExpand(row.sopId)}
                >
                  <div className="sop-status-title">
                    <span className="role-badge">{row.roleLabel}</span>
                    <strong>{row.sopTitle}</strong>
                  </div>
                  <div className="sop-status-metrics">
                    <div className="sop-progress-track">
                      <div
                        className="sop-progress-fill"
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span>
                      {row.completedToday}/{row.totalItems} · {row.pct}%
                    </span>
                    {row.lastActivity && (
                      <span className="text-muted">
                        Last {formatChecklistTime(row.lastActivity)}
                      </span>
                    )}
                  </div>
                </button>
                {expandedSopId === row.sopId && (
                  <ul className="sop-detail-list">
                    {expandedItems.map((item) => (
                      <li key={item.itemId} className={item.completed ? "done" : ""}>
                        <span>{item.completed ? "✓" : "○"}</span>
                        <span>{item.label}</span>
                        <span className="text-muted">
                          {item.completed
                            ? `completed ${formatChecklistTime(item.completedAt)}${
                                item.completedByLabel
                                  ? ` · ${item.completedByLabel}`
                                  : ""
                              }`
                            : "not done"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </section>
      )}

      {!loading && tab === "manage" && isOwner && (
        <section className="operations-manage">
          <div className="sop-manage-list">
            {sops.map((sop) => (
              <div key={sop.id} className="sop-manage-row">
                <div>
                  <span className="role-badge">{roleBadgeLabel(sopToFormRole(sop.role))}</span>
                  <strong>{sop.title}</strong>
                  <span className="text-muted">
                    {" "}
                    · {sop.items.length} steps · {sop.frequency}
                  </span>
                </div>
                <div className="sop-manage-actions">
                  <button type="button" className="btn-dark btn-sm" onClick={() => openEditModal(sop)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn-dark btn-sm"
                    onClick={() => void deleteSop(sop)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="access-codes-section">
            <div className="access-codes-head">
              <h2>Access Codes</h2>
              <button
                type="button"
                className="btn-amber btn-sm"
                onClick={() => {
                  setAccessSopId(sops[0]?.id ?? "");
                  setAccessModalOpen(true);
                }}
                disabled={sops.length === 0}
              >
                Create Access Code
              </button>
            </div>
            <table className="access-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>PIN</th>
                  <th>SOP</th>
                  <th>Last Used</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {accessCodes.map((code) => (
                  <tr key={code.id}>
                    <td>{code.label}</td>
                    <td className="pin-cell">{code.pin ?? "n/a"}</td>
                    <td>{code.sopTitle}</td>
                    <td>
                      {code.lastUsedAt
                        ? new Date(code.lastUsedAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-dark btn-sm"
                        onClick={() => void revokeAccess(code.id)}
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="modal-panel sop-modal"
            role="dialog"
            aria-label={editingSop ? "Edit SOP" : "Create SOP"}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{editingSop ? "Edit SOP" : "Create SOP"}</h2>
            <label>
              Title
              <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </label>
            <label>
              Assign to role
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as SopRoleOption)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {roleBadgeLabel(r)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Frequency
              <select
                value={formFrequency}
                onChange={(e) => setFormFrequency(e.target.value)}
              >
                {FREQUENCY_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="sop-items-editor">
              <h3>Checklist Items</h3>
              {formItems.map((item, idx) => (
                <div key={idx} className="sop-item-row">
                  <input
                    value={item.label}
                    onChange={(e) => {
                      const next = [...formItems];
                      const row = next[idx];
                      if (!row) return;
                      row.label = e.target.value;
                      setFormItems(next);
                    }}
                    placeholder={`Step ${idx + 1}`}
                  />
                  <button type="button" onClick={() => moveItem(idx, -1)} aria-label="Move up">
                    ↑
                  </button>
                  <button type="button" onClick={() => moveItem(idx, 1)} aria-label="Move down">
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFormItems(formItems.filter((_, i) => i !== idx))
                    }
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-dark btn-sm"
                onClick={() =>
                  setFormItems([
                    ...formItems,
                    { label: "", sortOrder: formItems.length },
                  ])
                }
              >
                + Add Step
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-dark" onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-amber" onClick={() => void handleSaveSop()}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {accessModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAccessModalOpen(false)}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-label="Create access code"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Create Access Code</h2>
            <label>
              Label
              <input
                value={accessLabel}
                onChange={(e) => setAccessLabel(e.target.value)}
                placeholder="Cleaner"
              />
            </label>
            <label>
              SOP
              <select value={accessSopId} onChange={(e) => setAccessSopId(e.target.value)}>
                {sops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="btn-dark" onClick={() => setAccessModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn-amber" onClick={() => void createAccess()}>
                Generate
              </button>
            </div>
          </div>
        </div>
      )}

      {accessResult && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setAccessResult(null)}
        >
          <div
            className="modal-panel access-result-modal"
            role="dialog"
            aria-label="Access code created"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Access Code Ready</h2>
            <p className="access-pin-display">{accessResult.pin.split("").join(" ")}</p>
            <canvas ref={qrCanvasRef} />
            <p className="text-muted access-url">{checklistUrl}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-dark"
                onClick={() => {
                  void navigator.clipboard.writeText(checklistUrl);
                  showToast("URL copied", "success");
                }}
              >
                Copy URL
              </button>
              <button
                type="button"
                className="btn-amber"
                onClick={() => window.print()}
              >
                Print QR Code
              </button>
              <button type="button" className="btn-dark" onClick={() => setAccessResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {!isOwner && (
        <p className="text-muted operations-note">
          SOP management is owner-only.{" "}
          <Link to="/dashboard" className="mobile-link-amber">
            Back to dashboard
          </Link>
        </p>
      )}
    </div>
  );
}
