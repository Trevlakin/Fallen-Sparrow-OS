export type JarvisIntentKind = "QUERY" | "COMMAND";

export interface JarvisIntentResult {
  type: "query_response" | "command_response";
  intent: JarvisIntentKind;
  confidence: number;
  message?: string;
  requiresApproval?: boolean;
  subType?: string;
}

function lineClassName(line: string): string {
  if (line.includes("🔴")) return "jarvis-query-line jarvis-query-line-alert";
  if (line.includes("⚠️")) return "jarvis-query-line jarvis-query-line-warn";
  if (line.includes("✅")) return "jarvis-query-line jarvis-query-line-ok";
  if (line.trim().startsWith("•")) return "jarvis-query-line jarvis-query-line-bullet";
  return "jarvis-query-line";
}

export function JarvisResponseRenderer({ result }: { result: JarvisIntentResult }) {
  const lines = (result.message ?? "").split("\n").filter((line) => line.trim());

  return (
    <div className="jarvis-query-panel" role="status" aria-live="polite">
      <div className="jarvis-query-header">
        <span
          className={`jarvis-query-badge jarvis-query-badge-${result.intent.toLowerCase()}`}
        >
          {result.intent === "QUERY" ? "JARVIS Query" : "JARVIS Command"}
        </span>
      </div>
      <div className="jarvis-query-body">
        {lines.length === 0 ? (
          <p className="jarvis-query-line text-muted">No response text returned.</p>
        ) : (
          lines.map((line, index) => (
            <p key={`${index}-${line.slice(0, 24)}`} className={lineClassName(line)}>
              {line.trim()}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
