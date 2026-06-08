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

function randomPin(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

export function AddEmployeeModal({ open, onClose, onCreate }: AddEmployeeModalProps) {
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamMemberRole>("FRONT_DESK");
  const [pin, setPin] = useState(randomPin());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setRole("FRONT_DESK");
      setPin(randomPin());
      setError("");
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await onCreate({ name: name.trim(), role, pin });
      setPin(result.pin);
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
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" />
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
          <div className="form-field">
            <span>PIN</span>
            <div className="pin-generate-row">
              <strong className="generated-pin">{pin}</strong>
              <button type="button" className="btn-text" onClick={() => setPin(randomPin())}>
                Regenerate
              </button>
            </div>
            <p className="text-muted form-hint">
              Shown once. Note it down or change it after creating the employee.
            </p>
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              Create employee
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
