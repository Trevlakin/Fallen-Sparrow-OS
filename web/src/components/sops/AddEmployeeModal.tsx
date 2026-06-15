import { FormEvent, useEffect, useState } from "react";
import {
  TEAM_MEMBER_ROLE_LABELS,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";

interface AddEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    role: TeamMemberRole;
    pin: string;
  }) => Promise<{ pin: string }>;
}


export function AddEmployeeModal({ open, onClose, onCreate }: AddEmployeeModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<TeamMemberRole>("FRONT_DESK");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setRole("FRONT_DESK");
      setPin("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      setError("First name is required");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    const name = lastName.trim()
      ? `${firstName.trim()} ${lastName.trim()}`
      : firstName.trim();
    setSaving(true);
    setError("");
    try {
      await onCreate({ name, role, pin });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create employee");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card sops-modal"
        role="dialog"
        aria-labelledby="add-employee-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="add-employee-title">Add employee</h2>
        <form onSubmit={(e) => void submit(e)}>
          <label className="form-field">
            <span>First name</span>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              required
            />
          </label>
          <label className="form-field">
            <span>Last name (optional)</span>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </label>
          <label className="form-field">
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value as TeamMemberRole)}>
              {TEAM_MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {TEAM_MEMBER_ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>PIN (4 digits)</span>
            <input
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0000"
              required
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              Save
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
