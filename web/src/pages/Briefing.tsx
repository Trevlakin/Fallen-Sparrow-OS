import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BriefingNarrative } from "@/components/BriefingNarrative";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/lib/api";
import { useIsOwner } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

interface Briefing {
  id: string;
  narrative: string | null;
  dataSnapshot: {
    followupsDueToday?: { clientName: string; followupType: string }[];
  } | null;
  generatedAt: string | null;
}

export function BriefingPage() {
  const isOwner = useIsOwner();
  const { showToast } = useToast();
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<Briefing>("/api/briefing/latest");
      setBriefing(res);
    } catch {
      setBriefing(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.post("/api/briefing/generate", { type: "daily" });
      await load();
      showToast("Briefing generated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header-row">
        <h1>AI Briefing</h1>
        {isOwner && (
          <button
            type="button"
            className="btn-amber"
            onClick={() => void handleGenerate()}
            disabled={generating}
          >
            {generating ? "Generating..." : "Generate Briefing"}
          </button>
        )}
      </div>
      {loading && <p className="text-muted">Loading...</p>}
      {!loading && briefing && (briefing.dataSnapshot?.followupsDueToday?.length ?? 0) > 0 && (
        <Link to="/followups" className="mobile-nudge-badge briefing-followups-alert">
          <span className="mobile-nudge-count">
            {briefing.dataSnapshot!.followupsDueToday!.length}
          </span>
          <span>
            client follow-up
            {briefing.dataSnapshot!.followupsDueToday!.length === 1 ? "" : "s"} due today
          </span>
          <span className="mobile-nudge-arrow">→</span>
        </Link>
      )}
      {!loading && !briefing && (
        <EmptyState
          icon="📰"
          title="No briefing yet"
          description="Generate your first AI briefing to get a daily digest of shop metrics, nudges, and action items."
          ctaLabel={isOwner ? "Generate Now" : undefined}
          onCtaClick={isOwner ? () => void handleGenerate() : undefined}
        />
      )}
      {briefing && (
        <article className="briefing-card">
          <p className="text-muted">
            Generated{" "}
            {briefing.generatedAt
              ? new Date(briefing.generatedAt).toLocaleString()
              : "n/a"}
          </p>
          <BriefingNarrative text={briefing.narrative ?? ""} />
          <BriefingFooterLinks narrative={briefing.narrative ?? ""} />
          <details>
            <summary>Structured snapshot</summary>
            <pre>{JSON.stringify(briefing.dataSnapshot, null, 2)}</pre>
          </details>
        </article>
      )}
    </div>
  );
}

function BriefingFooterLinks({ narrative }: { narrative: string }) {
  const lower = narrative.toLowerCase();
  const links: Array<{ label: string; to: string }> = [];

  if (
    lower.includes("inventory") ||
    lower.includes("stock") ||
    lower.includes("supply") ||
    lower.includes("out of")
  ) {
    links.push({ label: "Low inventory mentioned? Inventory", to: "/inventory" });
  }
  if (
    lower.includes("checklist") ||
    lower.includes("sop") ||
    lower.includes("incomplete")
  ) {
    links.push({ label: "Incomplete checklists? SOPs", to: "/sops" });
  }
  if (
    lower.includes("commission") ||
    lower.includes("payout") ||
    lower.includes("payroll")
  ) {
    links.push({ label: "Commission due? P&L", to: "/pnl" });
  }
  if (
    lower.includes("follow-up") ||
    lower.includes("follow up") ||
    lower.includes("check-in") ||
    lower.includes("check in")
  ) {
    links.push({ label: "Client follow-ups due? Follow-ups", to: "/followups" });
  }

  if (links.length === 0) return null;

  return (
    <footer className="briefing-footer-links">
      {links.map((link) => (
        <Link key={link.to} to={link.to}>
          {link.label} →
        </Link>
      ))}
    </footer>
  );
}
