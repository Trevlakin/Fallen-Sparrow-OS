import { TEAM_MEMBER_ROLE_LABELS } from "@fallen-sparrow/shared/constants";
import type { TeamMemberRow } from "@/components/sops/EmployeePinTable";

interface PinReferenceNoteProps {
  members: TeamMemberRow[];
}

export function PinReferenceNote({ members }: PinReferenceNoteProps) {
  const activeMembers = members.filter((member) => member.isActive !== false);

  return (
    <section className="sops-panel pin-reference-note" aria-label="Current team PIN reference">
      <div className="sops-panel-head">
        <h2>Current PIN reference</h2>
        <p className="sops-panel-note">
          Owner and manager only. Updates when a PIN is set or changed.
        </p>
      </div>
      <ul className="pin-reference-list">
        {activeMembers.map((member) => (
          <li key={member.id} className="pin-reference-row">
            <span className="pin-reference-name">{member.displayName}</span>
            <span className="role-tag">{TEAM_MEMBER_ROLE_LABELS[member.role]}</span>
            <span className="pin-reference-value">
              {member.pin ?? "Not available"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
