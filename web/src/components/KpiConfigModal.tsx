import { useState } from "react";
import {
  ARTIST_METRICS,
  DEFAULT_KPI_CONFIG,
  REVENUE_METRICS,
  SERVICE_METRICS,
  saveKpiConfig,
  type KpiConfig,
} from "@/lib/kpiConfig";

interface KpiConfigModalProps {
  config: KpiConfig;
  onApply: (config: KpiConfig) => void;
  onClose: () => void;
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="kpi-toggle-row">
      <button
        type="button"
        className={`kpi-toggle ${checked ? "on" : "off"}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      />
      <span>
        <strong>{label}</strong>
        <span className="kpi-toggle-desc">{description}</span>
      </span>
    </label>
  );
}

function MetricColumn({
  title,
  metrics,
  draft,
  setDraft,
}: {
  title: string;
  metrics: typeof REVENUE_METRICS;
  draft: KpiConfig;
  setDraft: React.Dispatch<React.SetStateAction<KpiConfig>>;
}) {
  const keys = metrics.map((m) => m.key);

  const selectAll = () => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = true;
      return next;
    });
  };

  const clearAll = () => {
    setDraft((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = false;
      return next;
    });
  };

  return (
    <div className="kpi-column">
      <div className="kpi-column-header">
        <h3>{title}</h3>
        <div className="kpi-column-actions">
          <button type="button" onClick={selectAll}>
            Select All
          </button>
          <span>|</span>
          <button type="button" onClick={clearAll}>
            Clear All
          </button>
        </div>
      </div>
      {metrics.map((m) => (
        <Toggle
          key={m.key}
          checked={draft[m.key]}
          onChange={(v) => setDraft((prev) => ({ ...prev, [m.key]: v }))}
          label={m.label}
          description={m.description}
        />
      ))}
    </div>
  );
}

export function KpiConfigModal({ config, onApply, onClose }: KpiConfigModalProps) {
  const [draft, setDraft] = useState<KpiConfig>({ ...config });

  const selectAllGlobal = () => setDraft({ ...DEFAULT_KPI_CONFIG });
  const clearAllGlobal = () => {
    const cleared = { ...DEFAULT_KPI_CONFIG };
    for (const key of Object.keys(cleared) as Array<keyof KpiConfig>) {
      cleared[key] = false;
    }
    setDraft(cleared);
  };

  const handleApply = () => {
    saveKpiConfig(draft);
    onApply(draft);
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="kpi-modal"
        role="dialog"
        aria-labelledby="kpi-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kpi-modal-global">
          <button type="button" onClick={selectAllGlobal}>
            Select All
          </button>
          <span>|</span>
          <button type="button" onClick={clearAllGlobal}>
            Clear All
          </button>
        </div>
        <h2 id="kpi-modal-title">KPI Configuration Panel</h2>
        <p className="kpi-modal-subtitle">
          Enable and configure the metrics you want to see on your dashboard
        </p>
        <div className="kpi-columns">
          <MetricColumn
            title="REVENUE METRICS"
            metrics={REVENUE_METRICS}
            draft={draft}
            setDraft={setDraft}
          />
          <MetricColumn
            title="ARTIST PERFORMANCE"
            metrics={ARTIST_METRICS}
            draft={draft}
            setDraft={setDraft}
          />
          <MetricColumn
            title="SERVICE ANALYSIS"
            metrics={SERVICE_METRICS}
            draft={draft}
            setDraft={setDraft}
          />
        </div>
        <button type="button" className="btn-amber btn-full" onClick={handleApply}>
          Apply Settings
        </button>
      </div>
    </div>
  );
}
