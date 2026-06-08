import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CsvColumnMapperModal } from "@/components/CsvColumnMapperModal";
import { QuickBooksConnect } from "@/components/QuickBooksConnect";
import { ImportResultBlock } from "@/components/ImportResultBlock";
import { RatesWarning } from "@/components/RatesWarning";
import { ShareDemoLink } from "@/components/ShareDemoLink";
import { APPOINTMENT_CSV_FIELDS } from "@/lib/csvMappingFields";
import type { ImportResult } from "@/lib/csvImport";
import { emitCsvImport } from "@/lib/eventBus";
import { useToast } from "@/context/ToastContext";
import { useTour } from "@/hooks/useTour";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SettingsData {
  commissionRates: {
    tattoo: number;
    piercing: number;
    laser: number;
    other: number;
  };
  walkInBonus: number;
  referralBonus: number;
  timezone: string;
  briefingHour: number;
  nudgeGapDays: number;
  confirmRates: boolean;
}

type RateKey = keyof SettingsData["commissionRates"];

const RATE_LABELS: Record<RateKey, string> = {
  tattoo: "Tattoo",
  piercing: "Piercing",
  laser: "Laser Removal",
  other: "Other",
};

export function SettingsPage() {
  const { showToast } = useToast();
  const { replayTour } = useTour(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [csvMapperOpen, setCsvMapperOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [appointmentsResult, setAppointmentsResult] = useState<ImportResult | null>(null);
  const [appointmentsImportError, setAppointmentsImportError] = useState<string | null>(null);
  const appointmentsFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api
      .get<SettingsData>("/api/settings")
      .then(setSettings)
      .finally(() => setLoading(false));
  }, []);

  const updateRate = (key: RateKey, value: number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      commissionRates: { ...settings.commissionRates, [key]: value },
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api.patch<SettingsData>("/api/settings", settings);
      setSettings(updated);
      showToast("Settings saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      showToast("New passwords do not match", "error");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      showToast("Password updated", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Password change failed", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAppointmentsCsvFile = async (file: File) => {
    setAppointmentsResult(null);
    setAppointmentsImportError(null);
    const csv = await file.text();
    setPendingCsv(csv);
    setCsvMapperOpen(true);
  };

  const handleAppointmentsImportComplete = (result: ImportResult) => {
    setAppointmentsResult(result);
    if (result.imported > 0) {
      showToast(`${result.imported} records imported. Dashboard updated.`, "success");
      emitCsvImport("appointments");
    }
  };

  if (loading) {
    return (
      <div className="page">
        <h1>Settings</h1>
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="page">
        <h1>Settings</h1>
        <p className="error-text">Could not load settings.</p>
      </div>
    );
  }

  return (
    <div className="page settings-page">
      <h1>Settings</h1>
      <p className="text-muted">Owner-only studio configuration</p>

      <ShareDemoLink />

      <RatesWarning />

      <section className="settings-section integrations-section">
        <h2>Integrations</h2>
        <QuickBooksConnect />
      </section>

      <form onSubmit={(e) => void handleSave(e)} className="settings-section">
        <h2 id="commission-rates">Commission Rates</h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Artist Share</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(RATE_LABELS) as RateKey[]).map((key) => (
                <tr key={key}>
                  <td>{RATE_LABELS[key]}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(settings.commissionRates[key] * 100)}
                      onChange={(e) =>
                        updateRate(key, Number(e.target.value) / 100)
                      }
                      className="rate-input"
                    />
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.confirmRates}
            onChange={(e) =>
              setSettings({ ...settings, confirmRates: e.target.checked })
            }
          />
          Rates confirmed with studio owner
        </label>

        <h2>Bonuses</h2>
        <div className="settings-grid">
          <label className="form-field">
            Walk-in bonus ($)
            <input
              type="number"
              min={0}
              step={1}
              value={settings.walkInBonus}
              onChange={(e) =>
                setSettings({ ...settings, walkInBonus: Number(e.target.value) })
              }
            />
          </label>
          <label className="form-field">
            Referral bonus ($)
            <input
              type="number"
              min={0}
              step={1}
              value={settings.referralBonus}
              onChange={(e) =>
                setSettings({ ...settings, referralBonus: Number(e.target.value) })
              }
            />
          </label>
        </div>

        <h2>Briefing Schedule</h2>
        <p className="text-muted settings-readonly">
          Timezone: {settings.timezone}
          <br />
          Daily briefing hour: {settings.briefingHour}:00 ({settings.timezone})
          <br />
          Nudge gap threshold: {settings.nudgeGapDays} days
        </p>

        <button type="submit" className="btn-amber" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </form>

      <section className="settings-section import-section">
        <h2>Import Historical Data</h2>
        <p className="text-muted">
          Upload past appointment records and map columns from your export. Expense import
          is on the P&amp;L page.
        </p>

        <div className="import-card">
          <h3>Appointment Records</h3>
          <p className="text-muted">
            Import from Porter or any spreadsheet — you choose which column maps to each
            field.
          </p>
          <div className="import-card-actions">
            <button
              type="button"
              className="btn-amber"
              onClick={() => appointmentsFileRef.current?.click()}
            >
              Upload CSV
            </button>
            <input
              ref={appointmentsFileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAppointmentsCsvFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <ImportResultBlock
            result={appointmentsResult}
            error={appointmentsImportError}
          />
        </div>
      </section>

      {csvMapperOpen && pendingCsv && (
        <CsvColumnMapperModal
          title="Map Appointment Columns"
          csv={pendingCsv}
          format="appointments"
          fields={APPOINTMENT_CSV_FIELDS}
          onClose={() => {
            setCsvMapperOpen(false);
            setPendingCsv(null);
          }}
          onImported={handleAppointmentsImportComplete}
        />
      )}

      <section className="settings-section account-section">
        <h2>Account</h2>
        <form onSubmit={(e) => void handleChangePassword(e)}>
          <label className="form-field">
            Current password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <label className="form-field">
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="form-field">
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="btn-dark" disabled={changingPassword}>
            {changingPassword ? "Updating..." : "Change Password"}
          </button>
        </form>
      </section>

      {isDesktop && (
        <section className="settings-section tour-replay-section">
          <h2>Onboarding</h2>
          <p className="text-muted">
            Walk through the dashboard tour again to revisit KPI cards, navigation, and
            key features.
          </p>
          <button type="button" className="btn-dark" onClick={replayTour}>
            ↺ Replay onboarding tour
          </button>
        </section>
      )}
    </div>
  );
}
