import { useCallback, useEffect, useState } from "react";
import {
  FOLLOWUP_TYPES,
  FOLLOWUP_TYPE_DESCRIPTIONS,
  FOLLOWUP_TYPE_LABELS,
  type FollowupType,
} from "@fallen-sparrow/shared/constants";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/context/ToastContext";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { useEventBusRefresh } from "@/hooks/useEventBusRefresh";
import { formatDateOnly, toDateInput } from "@/lib/format";

interface FollowupRow {
  id: string;
  clientName: string;
  clientPhone: string | null;
  artistId: string | null;
  artistName: string | null;
  appointmentDate: string;
  followupType: string;
  dueDate: string;
  contactedAt: string | null;
  contactNotes: string | null;
  closed: boolean;
  daysOverdue: number | null;
}

const FOLLOWUP_LEGEND_TYPES: FollowupType[] = [...FOLLOWUP_TYPES];

function followupLabel(type: string): string {
  if (type in FOLLOWUP_TYPE_LABELS) {
    return FOLLOWUP_TYPE_LABELS[type as FollowupType];
  }
  return type;
}

function FollowupCard({
  row,
  onContact,
  onClose,
}: {
  row: FollowupRow;
  onContact: (row: FollowupRow) => void;
  onClose: (id: string) => void;
}) {
  const overdue = row.daysOverdue !== null && row.daysOverdue > 0;

  return (
    <li
      className={`activity-card followup-card${overdue ? " followup-card-overdue" : ""}`}
    >
      <div className="activity-card-head">
        <span className="activity-badge">{followupLabel(row.followupType)}</span>
        {overdue && (
          <span className="activity-badge activity-badge-priority">
            {row.daysOverdue} day{row.daysOverdue === 1 ? "" : "s"} overdue
          </span>
        )}
        {!overdue && (
          <span className="activity-status activity-status-open">Due today</span>
        )}
      </div>
      <p className="activity-card-title">{row.clientName}</p>
      <div className="activity-card-meta text-muted">
        {row.clientPhone && (
          <a href={`tel:${row.clientPhone}`} className="followup-phone-link">
            {row.clientPhone}
          </a>
        )}
        {row.artistName && <span>Artist: {row.artistName}</span>}
        <span>Session {formatDateOnly(row.appointmentDate)}</span>
        <span>Due {formatDateOnly(row.dueDate)}</span>
      </div>
      {row.contactedAt && (
        <p className="text-muted followup-contacted-note">
          Contacted {formatDateOnly(row.contactedAt.split("T")[0] ?? row.contactedAt)}
          {row.contactNotes ? `: ${row.contactNotes}` : ""}
        </p>
      )}
      <div className="activity-card-actions">
        <button
          type="button"
          className="btn-amber btn-sm"
          onClick={() => onContact(row)}
        >
          Mark contacted
        </button>
        <button
          type="button"
          className="btn-dark btn-sm"
          onClick={() => void onClose(row.id)}
        >
          Close
        </button>
      </div>
    </li>
  );
}

function UpcomingCard({ row }: { row: FollowupRow }) {
  return (
    <li className="activity-card followup-card">
      <div className="activity-card-head">
        <span className="activity-badge">{followupLabel(row.followupType)}</span>
        <span className="activity-status activity-status-in_progress">
          Due {formatDateOnly(row.dueDate)}
        </span>
      </div>
      <p className="activity-card-title">{row.clientName}</p>
      <div className="activity-card-meta text-muted">
        {row.clientPhone && (
          <a href={`tel:${row.clientPhone}`} className="followup-phone-link">
            {row.clientPhone}
          </a>
        )}
        {row.artistName && <span>Artist: {row.artistName}</span>}
        <span>Session {formatDateOnly(row.appointmentDate)}</span>
      </div>
    </li>
  );
}

export function FollowupsPage() {
  const { showToast } = useToast();
  const [dueNow, setDueNow] = useState<FollowupRow[]>([]);
  const [thisWeek, setThisWeek] = useState<FollowupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [contactRow, setContactRow] = useState<FollowupRow | null>(null);
  const [contactNotes, setContactNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const todayISO = toDateInput(new Date());
      const [dueRes, upcomingRes] = await Promise.all([
        api.get<{ followups: FollowupRow[] }>("/api/followups/due-today"),
        api.get<{ followups: FollowupRow[] }>("/api/followups/upcoming"),
      ]);
      setDueNow(dueRes.followups);
      const dueIds = new Set(dueRes.followups.map((f) => f.id));
      setThisWeek(
        upcomingRes.followups.filter(
          (f) => !dueIds.has(f.id) && f.dueDate > todayISO,
        ),
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load follow-ups", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEventBusRefresh([DATA_EVENTS.appointments, DATA_EVENTS.followups], load);

  const handleContactSubmit = async () => {
    if (!contactRow) return;
    setSubmitting(true);
    try {
      await api.post(`/api/followups/${contactRow.id}/contact`, {
        notes: contactNotes.trim(),
      });
      showToast("Contact logged", "success");
      setContactRow(null);
      setContactNotes("");
      emitData(DATA_EVENTS.followups);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (id: string) => {
    if (!window.confirm("Close this follow-up? It will not appear in reminders.")) {
      return;
    }
    try {
      await api.post(`/api/followups/${id}/close`, {});
      showToast("Follow-up closed", "success");
      emitData(DATA_EVENTS.followups);
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", "error");
    }
  };

  const empty = !loading && dueNow.length === 0 && thisWeek.length === 0;

  return (
    <div className="page activity-page followups-page">
      <div className="page-header-row">
        <h1>Follow-ups</h1>
      </div>
      <p className="text-muted activity-page-intro">
        Client check-ins auto-schedule when you log a sale or import a completed appointment.
        Four touchpoints per client: 2-week, 1-month, 2-month, and 6-month.
      </p>

      <div className="followup-type-legend">
        {FOLLOWUP_LEGEND_TYPES.map((type) => (
          <div key={type} className="followup-legend-item">
            <strong>{FOLLOWUP_TYPE_LABELS[type]}</strong>
            <span className="text-muted">{FOLLOWUP_TYPE_DESCRIPTIONS[type]}</span>
          </div>
        ))}
      </div>

      {loading && <p className="text-muted">Loading...</p>}

      {empty && (
        <EmptyState
          icon="📞"
          title="No follow-ups due"
          description="When you log a sale through P&L or import completed appointments, four client check-ins are scheduled automatically."
        />
      )}

      {!loading && dueNow.length > 0 && (
        <section className="followup-section">
          <h2 className="followup-section-title">
            Due now
            <span className="followup-section-count">{dueNow.length}</span>
          </h2>
          <ul className="activity-list">
            {dueNow.map((row) => (
              <FollowupCard
                key={row.id}
                row={row}
                onContact={setContactRow}
                onClose={handleClose}
              />
            ))}
          </ul>
        </section>
      )}

      {!loading && thisWeek.length > 0 && (
        <section className="followup-section">
          <h2 className="followup-section-title">
            This week
            <span className="followup-section-count">{thisWeek.length}</span>
          </h2>
          <ul className="activity-list">
            {thisWeek.map((row) => (
              <UpcomingCard key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}

      {contactRow && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setContactRow(null)}
        />
      )}
      {contactRow && (
        <div className="modal-panel followup-contact-modal" role="dialog" aria-label="Log contact">
          <h3>Mark contacted</h3>
          <p className="text-muted">
            {contactRow.clientName} · {followupLabel(contactRow.followupType)}
          </p>
          <label className="form-label" htmlFor="followup-notes">
            Notes (optional)
          </label>
          <textarea
            id="followup-notes"
            className="brain-dump-input"
            rows={3}
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            placeholder="Left voicemail, sent text, etc."
          />
          <div className="modal-actions">
            <button
              type="button"
              className="btn-dark"
              onClick={() => setContactRow(null)}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-amber"
              onClick={() => void handleContactSubmit()}
              disabled={submitting}
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
