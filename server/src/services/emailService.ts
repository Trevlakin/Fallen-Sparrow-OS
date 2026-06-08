/**
 * Briefing and nudge HTML email delivery via Resend (MASTER_SPEC_v3 §7).
 * Wraps integrations/resend.ts — no direct resend import elsewhere for these flows.
 */
import { sendEmail } from "../integrations/resend.js";
import { env } from "../config/env.js";

function mobileHtmlShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.5; color: #1a1a1a; margin: 0; padding: 16px; background: #f5f5f5; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 8px;
      padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    h1 { font-size: 1.125rem; margin: 0 0 12px; font-weight: 600; }
    p { margin: 0 0 12px; font-size: 1rem; }
    .footer { font-size: 0.75rem; color: #666; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    ${bodyHtml}
    <p class="footer">Fallen Sparrow Tattoo Co.</p>
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function narrativeToHtml(narrative: string): string {
  const lines = narrative
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const bulletItems = lines.map((line) => line.replace(/^[-*•]\s+/, "").trim()).filter(Boolean);
  const looksLikeBullets = lines.some((line) => /^[-*•]\s+/.test(line));

  if (looksLikeBullets && bulletItems.length > 0) {
    return `<ul style="margin:0;padding-left:1.25rem;line-height:1.5;">${bulletItems
      .map((item) => `<li style="margin-bottom:0.5rem;">${escapeHtml(item)}</li>`)
      .join("")}</ul>`;
  }

  return narrative
    .split(/\n\n+/)
    .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
    .join("");
}

export async function sendBriefingEmail(params: {
  to: string;
  subject: string;
  periodLabel: string;
  narrative: string;
}): Promise<boolean> {
  const body = `
    <h1>${escapeHtml(params.periodLabel)}</h1>
    ${narrativeToHtml(params.narrative)}
  `;
  return sendEmail({
    to: params.to,
    subject: params.subject,
    html: mobileHtmlShell(params.subject, body),
    from: env.RESEND_FROM_EMAIL,
  });
}

export async function sendNudgeEmail(params: {
  to: string;
  customerName: string;
  message: string;
}): Promise<boolean> {
  const body = `
    <p>Hi ${escapeHtml(params.customerName)},</p>
    <p>${escapeHtml(params.message)}</p>
  `;
  return sendEmail({
    to: params.to,
    subject: "Fallen Sparrow Tattoo",
    html: mobileHtmlShell("Message from Fallen Sparrow", body),
    from: env.RESEND_FROM_EMAIL,
  });
}
