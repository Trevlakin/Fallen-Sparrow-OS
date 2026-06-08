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
  return (
    <div className={`import-result ${success ? "import-result-success" : ""}`}>
      <p>
        {success ? "✓ " : ""}
        {result.imported} records imported · {result.skipped} skipped · {result.errors.length}{" "}
        errors
      </p>
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
