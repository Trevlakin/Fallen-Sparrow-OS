import type { TeamMemberRole } from "@fallen-sparrow/shared/constants";
import { TEAM_MEMBER_ROLE_LABELS } from "@fallen-sparrow/shared/constants";

export interface SopCardData {
  id: string;
  title: string;
  roles: TeamMemberRole[];
  isActive: boolean | null;
  items: { id: string; label: string; isActive?: boolean | null }[];
}

interface SopCardProps {
  sop: SopCardData;
  onEdit: (sop: SopCardData) => void;
}

export function SopCard({ sop, onEdit }: SopCardProps) {
  const activeItems = sop.items.filter((i) => i.isActive !== false);
  const preview = activeItems.slice(0, 5);
  const roleLabel =
    sop.roles.length > 0
      ? sop.roles.map((r) => TEAM_MEMBER_ROLE_LABELS[r]).join(", ")
      : "Unassigned";

  return (
    <button type="button" className="sop-card" onClick={() => onEdit(sop)}>
      <div className="sop-card-head">
        <h3>{sop.title}</h3>
        <span className={`sop-status-badge${sop.isActive === false ? " draft" : ""}`}>
          {sop.isActive === false ? "Draft" : "Active"}
        </span>
      </div>
      <p className="sop-card-role text-muted">{roleLabel}</p>
      <ul className="sop-card-preview">
        {preview.map((item) => (
          <li key={item.id}>
            <span aria-hidden>☐</span> {item.label}
          </li>
        ))}
      </ul>
      <div className="sop-card-footer">
        <span>{activeItems.length} items</span>
        <span className="sop-card-edit">Edit</span>
      </div>
    </button>
  );
}
