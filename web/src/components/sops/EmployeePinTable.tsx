import { FormEvent, useState } from "react";
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
  isActive?: boolean;
  pin?: string | null;
  pinVisible: boolean;
}

interface EmployeePinTableProps {
  members: TeamMemberRow[];
  showInactive: boolean;
  onToggleInactive: (value: boolean) => void;
  onChangePin: (id: string, pin: string) => Promise<void>;
  onUpdateMember: (
    id: string,
    input: { name: string; role: TeamMemberRole },
  ) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]!.charAt(0)}${parts[1]!.charAt(0)}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function EmployeePinTable({
  members,
  showInactive,
  onToggleInactive,
  onChangePin,
  onUpdateMember,
  onDeactivate,
}: EmployeePinTableProps) {
  return (
    <section className="sops-panel">
      <div className="sops-panel-head">
        <h2>Employee PINs</h2>
        <label className="checkbox-row sops-panel-note">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => onToggleInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>
      <ul className="employee-pin-list">
        {members.map((member) => (
          <EmployeePinRow
            key={member.id}
            member={member}
            onChangePin={onChangePin}
            onUpdateMember={onUpdateMember}
            onDeactivate={onDeactivate}
          />
        ))}
      </ul>
    </section>
  );
}

function EmployeePinRow({
  member,
  onChangePin,
  onUpdateMember,
  onDeactivate,
}: {
  member: TeamMemberRow;
  onChangePin: (id: string, pin: string) => Promise<void>;
  onUpdateMember: (
    id: string,
    input: { name: string; role: TeamMemberRole },
  ) => Promise<void>;
  onDeactivate: (id: string) => Promise<void>;
}) {
  const [editingPin, setEditingPin] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [pin, setPin] = useState("");
  const [name, setName] = useState(member.name);
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inactive = member.isActive === false;

  const submitPin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be 4 digits");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onChangePin(member.id, pin);
      setEditingPin(false);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change PIN");
    } finally {
      setSaving(false);
    }
  };

  const submitProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onUpdateMember(member.id, { name: name.trim(), role });
      setEditingProfile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update employee");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(`Deactivate ${member.displayName}?`)) return;
    setSaving(true);
    setError("");
    try {
      await onDeactivate(member.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className={`employee-pin-row${inactive ? " inactive" : ""}`}>
      <span className="employee-avatar">{initials(member.displayName)}</span>
      <div className="employee-pin-main">
        <div className="employee-pin-top">
          <strong>{member.displayName}</strong>
          <span className="role-tag">{TEAM_MEMBER_ROLE_LABELS[member.role]}</span>
          {inactive && <span className="role-tag inactive-tag">Inactive</span>}
        </div>

        {editingProfile ? (
          <form className="employee-profile-edit" onSubmit={(e) => void submitProfile(e)}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
            <select value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)}>
              {TEAM_MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {TEAM_MEMBER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <div className="employee-pin-actions">
              <button type="submit" className="btn-primary btn-sm" disabled={saving}>
                Save
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setEditingProfile(false);
                  setName(member.name);
                  setRole(member.role);
                  setError("");
                }}
              >
                Cancel
              </button>
              {!inactive && (
                <button
                  type="button"
                  className="btn-text danger-text"
                  disabled={saving}
                  onClick={() => void handleDeactivate()}
                >
                  Deactivate
                </button>
              )}
            </div>
          </form>
        ) : !editingPin ? (
          <div className="employee-pin-actions">
            <span className="pin-mask" aria-hidden>
              ●●●●
            </span>
            <button type="button" className="btn-text" onClick={() => setEditingPin(true)}>
              Change PIN
            </button>
            <button
              type="button"
              className="btn-text"
              onClick={() => {
                setEditingProfile(true);
                setName(member.name);
                setRole(member.role);
              }}
            >
              Edit
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
                setEditingPin(false);
                setPin("");
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
      </div>
    </li>
  );
}

export { TEAM_MEMBER_ROLES, TEAM_MEMBER_ROLE_LABELS };
