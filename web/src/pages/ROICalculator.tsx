import { useMemo, useState, type ChangeEvent } from "react";
import {
  buildRoiCopySummary,
  computeROI,
  DEFAULT_ROI_INPUTS,
  formatBreakEvenDisplay,
  formatRoiCurrency,
  ROI_DISCLAIMER,
  ROI_HERO_CONTEXT,
  ROI_YEAR1_SUB_LABEL,
  SESSION_LENGTH_HRS,
  type ROIInputs,
} from "@/lib/roiCalculator";
import { useToast } from "@/context/ToastContext";

export function ROICalculatorPage() {
  const { showToast } = useToast();
  const [inputs, setInputs] = useState<ROIInputs>(DEFAULT_ROI_INPUTS);
  const results = useMemo(() => computeROI(inputs), [inputs]);

  function setInput(key: keyof ROIInputs, value: string) {
    setInputs((prev) => ({ ...prev, [key]: parseFloat(value) || 0 }));
  }

  function handleNumberChange(
    key: keyof ROIInputs,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setInput(key, event.target.value);
  }

  function resetInputs() {
    setInputs(DEFAULT_ROI_INPUTS);
  }

  async function copyResults() {
    const text = buildRoiCopySummary(inputs, results);
    try {
      await navigator.clipboard.writeText(text);
      showToast("Results copied to clipboard", "success");
    } catch {
      showToast(text, "info");
    }
  }

  const resultRows = [
    {
      label: "Legion - extra sessions",
      sub: `${results.extraSessions.toFixed(1)} sessions × ${formatRoiCurrency(inputs.lCharge)}`,
      value: `${formatRoiCurrency(results.sessionRevenue)}/mo`,
      negative: false,
    },
    {
      label: "Hector - time freed up",
      sub: `${Math.round(results.hectorHrsFreed)} hrs freed × ${formatRoiCurrency(inputs.hRate)}/hr`,
      value: `${formatRoiCurrency(results.hectorGain)}/mo`,
      negative: false,
    },
    {
      label: "System cost",
      sub: "",
      value: `(${formatRoiCurrency(inputs.fee)}/mo)`,
      negative: true,
    },
    {
      label: "Bookkeeping cost",
      sub: "",
      value: `(${formatRoiCurrency(inputs.bookkeepingCost)}/mo)`,
      negative: true,
    },
  ];

  return (
    <div className="page roi-calc-page">
      <header className="roi-calc-header">
        <h1>ROI Calculator</h1>
        <p className="text-muted">
          What the system actually puts back in your pocket every month
        </p>
      </header>

      <div className="roi-calc-card">
        <section className="roi-calc-group">
          <div className="roi-calc-group-label">Legion - Owner &amp; Lead Artist</div>
          <div className="roi-calc-row roi-calc-row-2">
            <label className="roi-calc-field">
              <span className="roi-calc-label">Avg charge per session ($)</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.lCharge}
                onChange={(e) => handleNumberChange("lCharge", e)}
                step={10}
                min={0}
              />
            </label>
            <label className="roi-calc-field">
              <span className="roi-calc-label">Admin hours lost / week</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.lAdmin}
                onChange={(e) => handleNumberChange("lAdmin", e)}
                step={1}
                min={0}
                max={40}
              />
              <span className="roi-calc-hint">
                Data entry, reschedules, chasing numbers
              </span>
            </label>
          </div>

          <div className="roi-calc-derived">
            <span className="roi-calc-derived-label">
              Extra sessions freed up / month
            </span>
            <span className="roi-calc-derived-value">
              {results.extraSessions.toFixed(1)}/mo (
              {Math.round(results.monthlyHrsFreed)} hrs freed ÷{" "}
              {SESSION_LENGTH_HRS}hr sessions)
            </span>
          </div>
        </section>

        <div className="roi-calc-divider" />

        <section className="roi-calc-group">
          <div className="roi-calc-group-label">Hector - Manager</div>
          <div className="roi-calc-row roi-calc-row-2">
            <label className="roi-calc-field">
              <span className="roi-calc-label">Hourly rate ($)</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.hRate}
                onChange={(e) => handleNumberChange("hRate", e)}
                step={5}
                min={0}
              />
              <span className="roi-calc-hint">Value of his time</span>
            </label>
            <label className="roi-calc-field">
              <span className="roi-calc-label">Admin hours lost / week</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.hAdmin}
                onChange={(e) => handleNumberChange("hAdmin", e)}
                step={1}
                min={0}
                max={40}
              />
              <span className="roi-calc-hint">
                Daily tasks, follow-ups, tracking extras
              </span>
            </label>
          </div>
        </section>

        <div className="roi-calc-divider" />

        <section className="roi-calc-group">
          <div className="roi-calc-group-label">Your Investment</div>
          <div className="roi-calc-row roi-calc-row-2">
            <label className="roi-calc-field">
              <span className="roi-calc-label">Setup cost ($)</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.setup}
                onChange={(e) => handleNumberChange("setup", e)}
                step={500}
                min={0}
              />
              <span className="roi-calc-hint">One-time at launch</span>
            </label>
            <label className="roi-calc-field">
              <span className="roi-calc-label">Monthly fee ($)</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.fee}
                onChange={(e) => handleNumberChange("fee", e)}
                step={50}
                min={0}
              />
              <span className="roi-calc-hint">Recurring after setup</span>
            </label>
          </div>
          <div className="roi-calc-row roi-calc-row-2">
            <label className="roi-calc-field">
              <span className="roi-calc-label">Bookkeeping cost / month ($)</span>
              <input
                type="number"
                className="roi-calc-input"
                value={inputs.bookkeepingCost}
                onChange={(e) => handleNumberChange("bookkeepingCost", e)}
                step={50}
                min={0}
              />
              <span className="roi-calc-hint">Current accountant / bookkeeper</span>
            </label>
          </div>
        </section>
      </div>

      <div className="roi-calc-card roi-calc-results">
        {resultRows.map((row) => (
          <div key={row.label} className="roi-calc-result-row">
            <span className="roi-calc-result-label">
              {row.label}
              {row.sub ? (
                <span className="roi-calc-result-sub">{row.sub}</span>
              ) : null}
            </span>
            <span
              className={`roi-calc-result-value${
                row.negative ? " roi-calc-result-value--negative" : ""
              }`}
            >
              {row.value}
            </span>
          </div>
        ))}

        <div className="roi-calc-hero-row">
          <div className="roi-calc-hero-top">
            <span className="roi-calc-hero-label">Estimated monthly gain</span>
            <span
              className={`roi-calc-hero-value${
                results.net >= 0
                  ? " roi-calc-hero-value--positive"
                  : " roi-calc-hero-value--negative"
              }`}
            >
              {formatRoiCurrency(results.net)}/mo
            </span>
          </div>
          <p className="roi-calc-hero-context">{ROI_HERO_CONTEXT}</p>
        </div>
      </div>

      <div className="roi-calc-be-grid">
        <div className="roi-calc-be-item">
          <div className="roi-calc-be-label">Break-even</div>
          <div className="roi-calc-be-value">
            {formatBreakEvenDisplay(results.breakEvenMonths)}
          </div>
          <div className="roi-calc-be-sub">months to pay off setup</div>
        </div>
        <div className="roi-calc-be-item">
          <div className="roi-calc-be-label">Year 1 net gain</div>
          <div className="roi-calc-be-value">{formatRoiCurrency(results.yr1)}</div>
          <div className="roi-calc-be-sub">{ROI_YEAR1_SUB_LABEL}</div>
        </div>
      </div>

      <div className="roi-calc-disclaimer">{ROI_DISCLAIMER}</div>

      <div className="roi-calc-actions">
        <button type="button" className="btn-dark" onClick={resetInputs}>
          Reset
        </button>
        <button
          type="button"
          className="btn-amber"
          onClick={() => void copyResults()}
        >
          Copy results
        </button>
      </div>
    </div>
  );
}
