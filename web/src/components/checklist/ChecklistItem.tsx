import { formatChecklistTime } from "@/lib/checklistApi";

export interface ChecklistItemData {
  id: string;
  text: string;
  completed: boolean;
  completedAt: string | null;
}

interface ChecklistItemProps {
  item: ChecklistItemData;
  onToggle: (item: ChecklistItemData) => void;
}

export function ChecklistItemRow({ item, onToggle }: ChecklistItemProps) {
  return (
    <li>
      <button
        type="button"
        className={`checklist-item-btn${item.completed ? " completed" : ""}`}
        onClick={() => onToggle(item)}
      >
        <span className="checklist-check">{item.completed ? "✓" : "○"}</span>
        <span className="checklist-label">{item.text}</span>
        {item.completed && item.completedAt && (
          <span className="checklist-time">{formatChecklistTime(item.completedAt)}</span>
        )}
      </button>
    </li>
  );
}
