/**
 * Renders briefing narrative as scannable bullets (new format) or legacy prose.
 */

function parseBriefingBullets(text: string): string[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const marked = lines.filter((line) => /^[-*•]\s+/.test(line));
  if (marked.length > 0) {
    return lines.map((line) => line.replace(/^[-*•]\s+/, "").trim()).filter(Boolean);
  }

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
  if (sentences.length > 1) {
    return sentences;
  }

  return text.trim() ? [text.trim()] : [];
}

export function BriefingNarrative({ text, className = "" }: { text: string; className?: string }) {
  const bullets = parseBriefingBullets(text);
  if (bullets.length === 0) {
    return null;
  }

  return (
    <ul className={`briefing-bullets${className ? ` ${className}` : ""}`}>
      {bullets.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
