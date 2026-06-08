import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCtaClick?: () => void;
  ctaClassName?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  ctaTo,
  onCtaClick,
  ctaClassName = "btn-amber btn-sm",
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h4 className="empty-state-title">{title}</h4>
      <p className="empty-state-description text-muted">{description}</p>
      {ctaLabel && ctaTo && (
        <Link to={ctaTo} className={ctaClassName}>
          {ctaLabel}
        </Link>
      )}
      {ctaLabel && onCtaClick && !ctaTo && (
        <button type="button" className={ctaClassName} onClick={onCtaClick}>
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
