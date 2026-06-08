import { useState } from "react";
import {
  TEAM_MEMBER_ROLE_LABELS,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";

export interface TeamMemberRow {
  id: string;
  name: string;
  displayName: string;
  role: TeamMemberRole;
  pinVisible: boolean;
}

interface EmployeePinTableProps {
  members: TeamMemberRow[];
  onChangePin: (id: string, pin: string) => Promise<void>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmployeePinTable({ members, onChangePin }: EmployeePinTableProps) {
  return (
    <section className="sops-panel">
      <div className="sops-panel-head">
        <h2>Employee PINs</h2>
        <span className="sops-panel-note">Legion / Hector only</span>
      </div>
      <ul className="employee-pin-list">
        {members.map((member) => (
          <EmployeePinRow
            key={member.id}
            member={member}
            onChangePin={onChangePin}
          />
        ))}
      </ul>
    </section>
  );
}

function EmployeePinRow({
  member,
  onChangePin,
}: {
  member: TeamMemberRow;
  onChangePin: (id: string, pin: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submitPin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onChangePin(member.id, pin);
      setEditing(false);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change PIN");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="employee-pin-row">
      <span className="employee-avatar">{initials(member.displayName)}</span>
      <div className="employee-pin-main">
        <div className="employee-pin-top">
          <strong>{member.displayName}</strong>
          <span className="role-tag">{TEAM_MEMBER_ROLE_LABELS[member.role]}</span>
        </div>
        {!editing ? (
          <div className="employee-pin-actions">
            <span className="pin-mask" aria-hidden>
              ●●●●
            </span>
            <button type="button" className="btn-text" onClick={() => setEditing(true)}>
              Change
            </button>
          </div>
        ) : (
          <div className="employee-pin-edit">
            <input
              inputMode="numeric"
              maxLength={4}
              value={pin}
              placeholder="New PIN"
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={saving}
              onClick={() => void submitPin()}
            >
              Save
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setEditing(false);
                setPin("");
                setError("");
              }}
            >
              Cancel
            </button>
            {error && <p className="form-error">{error}</p>}
          </div>
        )}
      </div>
    </li>
  );
}

export { TEAM_MEMBER_ROLES, TEAM_MEMBER_ROLE_LABELS };
