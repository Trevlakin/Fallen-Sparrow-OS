import { useState } from "react";

export function ShareDemoLink() {
  const [copiedDash, setCopiedDash] = useState(false);
  const [copiedSOP, setCopiedSOP] = useState(false);

  const baseUrl = window.location.origin;
  const isLocal =
    baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");

  async function copy(url: string, which: "dash" | "sop") {
    try {
      await navigator.clipboard.writeText(url);
      if (which === "dash") {
        setCopiedDash(true);
        setTimeout(() => setCopiedDash(false), 2500);
      } else {
        setCopiedSOP(true);
        setTimeout(() => setCopiedSOP(false), 2500);
      }
    } catch {
      alert(url);
    }
  }

  return (
    <div
      style={{
        border: "0.5px solid var(--color-border-tertiary)",
        borderRadius: "var(--border-radius-lg)",
        overflow: "hidden",
        background: "var(--color-background-primary)",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "0.5px solid var(--color-border-tertiary)",
          background: "var(--color-background-secondary)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <i
          className="ti ti-share"
          aria-hidden="true"
          style={{ fontSize: "18px", color: "var(--color-text-secondary)" }}
        />
        <span
          style={{
            fontSize: "14px",
            fontWeight: "500",
            color: "var(--color-text-primary)",
          }}
        >
          Share for demo
        </span>
      </div>

      <div style={{ padding: "18px" }}>
        {isLocal && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(255,152,0,0.08)",
              border: "0.5px solid #ff9800",
              borderRadius: "var(--border-radius-md)",
              marginBottom: "16px",
              fontSize: "12px",
              color: "#ff9800",
              lineHeight: "1.6",
            }}
          >
            You are on localhost. Deploy to Railway and Netlify first so Legion
            can open this link on his phone.
          </div>
        )}

        <div
          style={{
            padding: "9px 12px",
            background: "var(--color-background-secondary)",
            borderRadius: "var(--border-radius-md)",
            fontFamily: "monospace",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
            wordBreak: "break-all",
            marginBottom: "14px",
          }}
        >
          {baseUrl}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            type="button"
            onClick={() => void copy(baseUrl, "dash")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: copiedDash
                ? "rgba(56,142,60,0.08)"
                : "var(--color-background-primary)",
              color: copiedDash
                ? "var(--color-text-success)"
                : "var(--color-text-primary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i
                className={`ti ${copiedDash ? "ti-check" : "ti-copy"}`}
                aria-hidden="true"
              />
              {copiedDash ? "Copied!" : "Copy dashboard link"}
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                fontWeight: "400",
              }}
            >
              Full app
            </span>
          </button>

          <button
            type="button"
            onClick={() => void copy(`${baseUrl}/sop-checklist`, "sop")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "11px 14px",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              background: copiedSOP
                ? "rgba(56,142,60,0.08)"
                : "var(--color-background-primary)",
              color: copiedSOP
                ? "var(--color-text-success)"
                : "var(--color-text-primary)",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i
                className={`ti ${copiedSOP ? "ti-check" : "ti-checklist"}`}
                aria-hidden="true"
              />
              {copiedSOP ? "Copied!" : "Copy staff checklist link"}
            </div>
            <span
              style={{
                fontSize: "11px",
                color: "var(--color-text-secondary)",
                fontWeight: "400",
              }}
            >
              PWA only
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
