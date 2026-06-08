import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { emitData, DATA_EVENTS } from "@/lib/eventBus";
import { formatCurrency, formatServiceType } from "@/lib/format";
import { useCanSendNudge } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

export interface CustomerContinuityProfile {
  customerId: string;
  name: string;
  email: string | null;
  phone: string | null;
  preferredArtistName: string | null;
  lastAppointmentDate: string | null;
  daysSinceLastAppointment: number | null;
  typicalGapDays: number | null;
  totalSpent: number;
  appointmentCount: number;
  isOverdue: boolean;
  tattooHistory: Array<{
    appointmentId: string;
    date: string;
    serviceType: string;
    artistName: string | null;
    totalRevenue: number;
    status: string;
  }>;
}

interface NudgeCandidate {
  customerId: string;
  suggestedMessage: string;
}

interface ContinuityDrawerProps {
  customerId: string | null;
  onClose: () => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return "n/a";
  return new Date(iso).toLocaleDateString();
}

export function ContinuityDrawer({ customerId, onClose }: ContinuityDrawerProps) {
  const canSendNudge = useCanSendNudge();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<CustomerContinuityProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNudgeModal, setShowNudgeModal] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [nudgeChannel, setNudgeChannel] = useState<"sms" | "email">("sms");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setProfile(null);
      setShowNudgeModal(false);
      return;
    }
    setLoading(true);
    void api
      .get<CustomerContinuityProfile>(`/api/customers/${customerId}`)
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [customerId]);

  const openNudgeModal = async () => {
    if (!customerId) return;
    try {
      const res = await api.get<{ candidates: NudgeCandidate[] }>(
        "/api/nudges/candidates",
      );
      const candidate = res.candidates.find((c) => c.customerId === customerId);
      if (!candidate) {
        showToast("This client is not eligible for a nudge right now", "error");
        return;
      }
      setNudgeMessage(candidate.suggestedMessage);
      setNudgeChannel(profile?.phone ? "sms" : "email");
      setShowNudgeModal(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not load nudge", "error");
    }
  };

  const handleSendNudge = async () => {
    if (!customerId) return;
    setSending(true);
    try {
      const result = await api.post<{ status: string }>(
        `/api/nudges/${customerId}/send`,
        { channel: nudgeChannel },
      );
      if (result.status === "sent") {
        showToast("Nudge sent successfully", "success");
        emitData(DATA_EVENTS.nudges);
        setShowNudgeModal(false);
      } else {
        showToast("Nudge delivery failed. Try again later.", "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to send nudge", "error");
    } finally {
      setSending(false);
    }
  };

  if (!customerId) return null;

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} role="presentation">
        <aside
          className="drawer-panel"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Client continuity profile"
        >
          <button type="button" className="drawer-close" onClick={onClose}>
            Close
          </button>
          {loading && <p className="text-muted">Loading profile...</p>}
          {!loading && profile && (
            <>
              <h2>{profile.name}</h2>
              <p className="text-muted">
                {profile.email ?? "No email"} · {profile.phone ?? "No phone"}
              </p>
              <div className="drawer-stats">
                <div>
                  <span className="label">Total spent</span>
                  <span className="value-amber">{formatCurrency(profile.totalSpent)}</span>
                </div>
                <div>
                  <span className="label">Appointments</span>
                  <span>{profile.appointmentCount}</span>
                </div>
                <div>
                  <span className="label">Preferred artist</span>
                  <span>{profile.preferredArtistName ?? "n/a"}</span>
                </div>
                <div>
                  <span className="label">Last visit</span>
                  <span>{formatDate(profile.lastAppointmentDate)}</span>
                </div>
                <div>
                  <span className="label">Typical gap</span>
                  <span>
                    {profile.typicalGapDays != null
                      ? `${profile.typicalGapDays} days`
                      : "n/a"}
                  </span>
                </div>
              </div>
              {profile.isOverdue ? (
                <p className="overdue-badge">Overdue for rebooking</p>
              ) : (
                <p className="status-badge-active">Active</p>
              )}
              {canSendNudge && profile.isOverdue && (
                <button
                  type="button"
                  className="btn-amber drawer-nudge-btn"
                  onClick={() => void openNudgeModal()}
                >
                  Send Nudge
                </button>
              )}
              <h3>History</h3>
              <ul className="history-list">
                {profile.tattooHistory.length === 0 && (
                  <li className="text-muted">No appointment history</li>
                )}
                {profile.tattooHistory.map((entry) => (
                  <li key={entry.appointmentId}>
                    <span>{formatDate(entry.date)}</span>
                    <span>{formatServiceType(entry.serviceType)}</span>
                    <span>{entry.artistName ?? "n/a"}</span>
                    <span className="value-amber">{formatCurrency(entry.totalRevenue)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {showNudgeModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowNudgeModal(false)}
          role="presentation"
        >
          <div
            className="nudge-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Send nudge"
          >
            <h3>Send Nudge</h3>
            <p className="text-muted">Warm reconnect message (no discounts)</p>
            <label className="form-field">
              Message
              <textarea
                rows={4}
                value={nudgeMessage}
                readOnly
                className="nudge-message-preview"
              />
            </label>
            <label className="form-field">
              Channel
              <select
                value={nudgeChannel}
                onChange={(e) => setNudgeChannel(e.target.value as "sms" | "email")}
              >
                <option value="sms" disabled={!profile?.phone}>
                  SMS {profile?.phone ? "" : "(no phone on file)"}
                </option>
                <option value="email" disabled={!profile?.email}>
                  Email {profile?.email ? "" : "(no email on file)"}
                </option>
              </select>
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-dark"
                onClick={() => setShowNudgeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-amber"
                disabled={sending}
                onClick={() => void handleSendNudge()}
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
