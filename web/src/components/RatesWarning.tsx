import { Link } from "react-router-dom";
import { useStudioSettings } from "@/hooks/useStudioSettings";

interface RatesWarningProps {
  variant?: "banner" | "compact";
  className?: string;
}

export function RatesWarning({ variant = "banner", className = "" }: RatesWarningProps) {
  const { confirmRates, loading } = useStudioSettings();

  if (loading || confirmRates !== false) return null;

  if (variant === "compact") {
    return (
      <span
        className={`rates-warning-tooltip${className ? ` ${className}` : ""}`}
        title="Based on unconfirmed commission rates. Confirm in Settings."
      >
        ⓘ
      </span>
    );
  }

  return (
    <div className={`rates-warning-banner${className ? ` ${className}` : ""}`} role="alert">
      Commission rates are estimates. Confirm in{" "}
      <Link to="/settings#commission-rates">Settings</Link> before processing payouts.
    </div>
  );
}
