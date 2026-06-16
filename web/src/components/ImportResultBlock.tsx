import { useState } from "react";
import type { ImportResult } from "@/lib/csvImport";

export function ImportResultBlock({
  result,
  error,
}: {
  result: ImportResult | null;
  error: string | null;
}) {
  const [errorsOpen, setErrorsOpen] = useState(false);

  if (error) {
    const isFormatError = error.includes("Column headers not recognized");
    return <p className={isFormatError ? "import-warning" : "error-text"}>{error}</p>;
  }
  if (!result) return null;

  const success = result.imported > 0;
  const hasPorterSummary =
    result.duplicates !== undefined ||
    result.pending !== undefined ||
    result.dateRange !== undefined ||
    (result.artists && result.artists.length > 0);

  return (
    <div className={`import-result ${success ? "import-result-success" : ""}`}>
      <p>
        {success ? "✓ " : ""}
        {result.imported} imported · {result.skipped} skipped
        {result.duplicates !== undefined ? ` · ${result.duplicates} duplicates` : ""}
        {result.pending !== undefined ? ` · ${result.pending} pending` : ""}
        {result.errors.length > 0 ? ` · ${result.errors.length} errors` : ""}
      </p>
      {hasPorterSummary && (
        <div className="import-result-meta text-muted">
          {result.dateRange && (
            <p>
              Date range: {result.dateRange.from} to {result.dateRange.to}
            </p>
          )}
          {result.artists && result.artists.length > 0 && (
            <p>Artists: {result.artists.join(", ")}</p>
          )}
        </div>
      )}
      {result.errors.length > 0 && (
        <div className="import-errors">
          <button
            type="button"
            className="import-errors-toggle"
            onClick={() => setErrorsOpen(!errorsOpen)}
          >
            {errorsOpen ? "Hide errors" : "Show errors"}
          </button>
          {errorsOpen && (
            <ul>
              {result.errors.map((entry) => (
                <li key={`${entry.row}-${entry.reason}`}>
                  Row {entry.row}: {entry.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
