import { FormEvent, useEffect, useState } from "react";
import {
  TEAM_MEMBER_ROLE_LABELS,
  TEAM_MEMBER_ROLES,
  type TeamMemberRole,
} from "@fallen-sparrow/shared/constants";
import type { SopCardData } from "./SopCard";

interface EditItem {
  id?: string;
  text: string;
  removed?: boolean;
}

interface SopEditPanelProps {
  sop: SopCardData | null;
  open: boolean;
  onClose: () => void;
  onSave: (input: {
    id?: string;
    title: string;
    roles: TeamMemberRole[];
    items: EditItem[];
  }) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function SopEditPanel({ sop, open, onClose, onSave, onDelete }: SopEditPanelProps) {
  const [title, setTitle] = useState("");
  const [roles, setRoles] = useState<TeamMemberRole[]>([]);
  const [items, setItems] = useState<EditItem[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(sop?.title ?? "");
    setRoles(sop?.roles ?? ["FRONT_DESK"]);
    setItems(
      sop?.items
        .filter((i) => i.isActive !== false)
        .map((i) => ({ id: i.id, text: i.label })) ?? [],
    );
    setNewItemText("");
    setError("");
  }, [open, sop]);

  if (!open) return null;

  const toggleRole = (role: TeamMemberRole) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("SOP name is required");
      return;
    }
    if (roles.length === 0) {
      setError("Assign at least one role");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        id: sop?.id,
        title: title.trim(),
        roles,
        items,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save SOP");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`sop-edit-panel${open ? " open" : ""}`}>
      <div className="sop-edit-panel-inner">
        <div className="sop-edit-head">
          <h2>{sop ? "Edit SOP" : "Create SOP"}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <form onSubmit={(e) => void submit(e)}>
          <label className="form-field">
            <span>SOP name</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <div className="form-field">
            <span>Checklist items</span>
            <ul className="sop-edit-items">
              {items.map((item, idx) => (
                <li key={item.id ?? `new-${idx}`}>
                  <input
                    value={item.text}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, text: e.target.value } : row,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    aria-label="Remove item"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    🗑
                  </button>
                </li>
              ))}
            </ul>
            <div className="sop-add-item-row">
              <input
                value={newItemText}
                placeholder="New item"
                onChange={(e) => setNewItemText(e.target.value)}
              />
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  if (!newItemText.trim()) return;
                  setItems((prev) => [...prev, { text: newItemText.trim() }]);
                  setNewItemText("");
                }}
              >
                Add item
              </button>
            </div>
          </div>

          <fieldset className="form-field sop-role-checkboxes">
            <legend>Assign to roles</legend>
            {TEAM_MEMBER_ROLES.map((role) => (
              <label key={role} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {TEAM_MEMBER_ROLE_LABELS[role]}
              </label>
            ))}
          </fieldset>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              Save
            </button>
            {sop?.id && onDelete && (
              <button
                type="button"
                className="btn-secondary danger-text"
                disabled={saving}
                onClick={() => {
                  if (!sop.id) return;
                  if (!window.confirm(`Deactivate "${sop.title}"?`)) return;
                  void onDelete(sop.id).then(onClose);
                }}
              >
                Delete
              </button>
            )}
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
