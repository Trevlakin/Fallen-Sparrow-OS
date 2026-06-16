import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { CsvColumnMapperModal } from "@/components/CsvColumnMapperModal";
import { QuickBooksConnect } from "@/components/QuickBooksConnect";
import { ImportResultBlock } from "@/components/ImportResultBlock";
import { ShareDemoLink } from "@/components/ShareDemoLink";
import { APPOINTMENT_CSV_FIELDS } from "@/lib/csvMappingFields";
import type { ImportResult } from "@/lib/csvImport";
import { postPorterTransactionsCsv } from "@/lib/csvImport";
import { isPorterAppointmentTransactionsExport } from "@fallen-sparrow/shared/porterCsv";
import { emitCsvImport } from "@/lib/eventBus";
import { useToast } from "@/context/ToastContext";
import { useTour } from "@/hooks/useTour";
import { useMediaQuery } from "@/hooks/useMediaQuery";

interface SettingsData {
  walkInBonus: number;
  referralBonus: number;
  timezone: string;
  briefingHour: number;
  nudgeGapDays: number;
}

interface CommissionTierRow {
  thresholdAmount: number;
  artistPct: number;
  shopPct: number;
  sortOrder: number;
}

interface CommissionTiersData {
  tiers: CommissionTierRow[];
  updatedAt: string | null;
}

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const { showToast } = useToast();
  const { replayTour } = useTour(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [commissionTiers, setCommissionTiers] = useState<CommissionTierRow[]>([]);
  const [commissionUpdatedAt, setCommissionUpdatedAt] = useState<string | null>(null);
  const [savingCommission, setSavingCommission] = useState(false);
  const [commissionMessage, setCommissionMessage] = useState("");
  const [commissionError, setCommissionError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [csvMapperOpen, setCsvMapperOpen] = useState(false);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [appointmentsResult, setAppointmentsResult] = useState<ImportResult | null>(null);
  const [appointmentsImportError, setAppointmentsImportError] = useState<string | null>(null);
  const [appointmentsImporting, setAppointmentsImporting] = useState(false);
  const appointmentsFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void Promise.all([
      api.get<SettingsData>("/api/settings"),
      api.get<CommissionTiersData>("/api/settings/commission-tiers"),
    ])
      .then(([settingsData, tiersData]) => {
        setSettings(settingsData);
        setCommissionTiers(tiersData.tiers);
        setCommissionUpdatedAt(tiersData.updatedAt);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateTier = (
    sortOrder: number,
    field: "thresholdAmount" | "artistPct",
    value: number,
  ) => {
    setCommissionTiers((prev) =>
      prev.map((tier) => {
        if (tier.sortOrder !== sortOrder) return tier;
        const artistPct = field === "artistPct" ? value : tier.artistPct;
        return {
          ...tier,
          [field]: value,
          shopPct: field === "artistPct" ? Math.max(0, 100 - value) : tier.shopPct,
          artistPct,
        };
      }),
    );
    setCommissionMessage("");
    setCommissionError("");
  };

  const addTier = () => {
    setCommissionTiers((prev) => [
      ...prev,
      {
        thresholdAmount: 0,
        artistPct: 60,
        shopPct: 40,
        sortOrder: prev.length + 1,
      },
    ]);
  };

  const saveCommissionTiers = async () => {
    setSavingCommission(true);
    setCommissionMessage("");
    setCommissionError("");
    try {
      const saved = await api.put<CommissionTiersData>("/api/settings/commission-tiers", {
        tiers: commissionTiers.map((tier) => ({
          thresholdAmount: tier.thresholdAmount,
          artistPct: tier.artistPct,
        })),
      });
      setCommissionTiers(saved.tiers);
      setCommissionUpdatedAt(saved.updatedAt);
      setCommissionMessage("Commission structure saved");
      showToast("Commission structure saved", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save. Try again.";
      setCommissionError(message);
    } finally {
      setSavingCommission(false);
    }
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
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setChangingPassword(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      setPasswordSuccess("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordForm(false);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Password change failed");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    setChangingEmail(true);
    try {
      await api.post("/api/auth/change-email", {
        currentPassword: emailCurrentPassword,
        newEmail,
      });
      setEmailSuccess("Email updated successfully");
      setNewEmail("");
      setEmailCurrentPassword("");
      setShowEmailForm(false);
      await refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Email change failed");
    } finally {
      setChangingEmail(false);
    }
  };

  const handleAppointmentsCsvFile = async (file: File) => {
    setAppointmentsResult(null);
    setAppointmentsImportError(null);
    const csv = await file.text();

    if (isPorterAppointmentTransactionsExport(csv)) {
      setAppointmentsImporting(true);
      try {
        const result = await postPorterTransactionsCsv(csv, file.name);
        handleAppointmentsImportComplete(result);
      } catch (err) {
        setAppointmentsImportError(
          err instanceof Error ? err.message : "Porter import failed",
        );
      } finally {
        setAppointmentsImporting(false);
      }
      return;
    }

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

      <section className="settings-section integrations-section">
        <h2>Integrations</h2>
        <QuickBooksConnect />
      </section>

      <section className="settings-section commission-tiers-section">
        <h2 id="commission-rates">Commission Structure</h2>
        <p className="text-muted">
          How artist payouts are calculated based on session amount.
        </p>

        <div className="commission-tier-list">
          {[...commissionTiers]
            .sort((a, b) => a.thresholdAmount - b.thresholdAmount)
            .map((tier, index) => (
              <div key={tier.sortOrder} className="commission-tier-card">
                <h3>Tier {index + 1}</h3>
                <div className="commission-tier-fields">
                  <label className="form-field">
                    {index === 0 ? "Sessions under ($)" : "Sessions $ and above"}
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={tier.thresholdAmount}
                      onChange={(e) =>
                        updateTier(tier.sortOrder, "thresholdAmount", Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="form-field">
                    Artist share (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={tier.artistPct}
                      onChange={(e) =>
                        updateTier(tier.sortOrder, "artistPct", Number(e.target.value))
                      }
                    />
                  </label>
                  <div className="commission-tier-shop">
                    <span className="account-label">Shop keeps</span>
                    <strong>{Math.max(0, 100 - tier.artistPct)}%</strong>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <button type="button" className="btn-text commission-add-tier" onClick={addTier}>
          + Add tier
        </button>

        <div className="commission-tier-actions">
          <button
            type="button"
            className="btn-amber"
            disabled={savingCommission}
            onClick={() => void saveCommissionTiers()}
          >
            {savingCommission ? "Saving..." : "Save Commission Structure"}
          </button>
          {commissionMessage && <p className="form-success">{commissionMessage}</p>}
          {commissionError && <p className="form-error">{commissionError}</p>}
          {commissionUpdatedAt && (
            <p className="text-muted commission-last-saved">
              Last saved:{" "}
              {new Date(commissionUpdatedAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </section>

      <form onSubmit={(e) => void handleSave(e)} className="settings-section">
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
          <h3>Upload Porter CSV</h3>
          <p className="text-muted">
            Download from Porter → Reports → Appointment Transactions. Upload the file
            directly. No reformatting needed.
          </p>
          <div className="import-card-actions">
            <button
              type="button"
              className="btn-amber"
              onClick={() => appointmentsFileRef.current?.click()}
              disabled={appointmentsImporting}
            >
              {appointmentsImporting ? "Importing..." : "Upload Porter CSV"}
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
        <h2>Account Settings</h2>
        <div className="account-settings-row">
          <div>
            <span className="account-label">Email address</span>
            <p>{user?.email ?? "n/a"}</p>
          </div>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setShowEmailForm((v) => !v);
              setShowPasswordForm(false);
              setEmailError("");
              setEmailSuccess("");
            }}
          >
            Change
          </button>
        </div>
        {showEmailForm && (
          <form className="account-inline-form" onSubmit={(e) => void handleChangeEmail(e)}>
            <label className="form-field">
              New email address
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </label>
            <label className="form-field">
              Current password
              <input
                type="password"
                value={emailCurrentPassword}
                onChange={(e) => setEmailCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {emailError && <p className="form-error">{emailError}</p>}
            {emailSuccess && <p className="form-success">{emailSuccess}</p>}
            <div className="account-form-actions">
              <button type="submit" className="btn-dark" disabled={changingEmail}>
                {changingEmail ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowEmailForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="account-settings-row">
          <div>
            <span className="account-label">Password</span>
            <p>••••••••••••</p>
          </div>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setShowPasswordForm((v) => !v);
              setShowEmailForm(false);
              setPasswordError("");
              setPasswordSuccess("");
            }}
          >
            Change
          </button>
        </div>
        {showPasswordForm && (
          <form className="account-inline-form" onSubmit={(e) => void handleChangePassword(e)}>
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
              Confirm password
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </label>
            {passwordError && <p className="form-error">{passwordError}</p>}
            {passwordSuccess && <p className="form-success">{passwordSuccess}</p>}
            <div className="account-form-actions">
              <button type="submit" className="btn-dark" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Save"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowPasswordForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
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
