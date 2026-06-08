import { useMemo, useState } from "react";
import {
  buildMappingPayload,
  isMappingComplete,
  suggestColumnMapping,
  type CsvFieldDef,
} from "@/lib/csvMappingFields";
import { parseCsvText } from "@/lib/parseCsvClient";
import { postCsvImportMapped, type ImportResult } from "@/lib/csvImport";

const SKIP_VALUE = "";

interface CsvColumnMapperModalProps {
  title: string;
  csv: string;
  format: "expenses" | "appointments";
  fields: CsvFieldDef[];
  fileName?: string;
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}

export function CsvColumnMapperModal({
  title,
  csv,
  format,
  fields,
  fileName,
  onClose,
  onImported,
}: CsvColumnMapperModalProps) {
  const { headers, rows } = useMemo(() => parseCsvText(csv), [csv]);
  const [mapping, setMapping] = useState<Record<string, string>>(() =>
    suggestColumnMapping(headers, fields),
  );
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRows = rows.slice(0, 3);
  const canImport = headers.length > 0 && isMappingComplete(mapping, fields);

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);
    setError(null);
    try {
      const result = await postCsvImportMapped({
        csv,
        format,
        mapping: buildMappingPayload(mapping),
        fileName,
      });
      onImported(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="kpi-modal csv-mapper-modal"
        role="dialog"
        aria-labelledby="csv-mapper-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="csv-mapper-title">{title}</h2>
        <p className="text-muted">
          Match each field to a column in your file. Only the columns you map are imported
          — the rest of the spreadsheet is ignored.
        </p>

        {headers.length === 0 ? (
          <p className="error-text">No column headers found in this file.</p>
        ) : (
          <>
            <div className="csv-mapper-grid">
              {fields.map((field) => (
                <label key={field.key} className="form-field csv-map-field">
                  <span>
                    {field.label}
                    {field.required ? " *" : " (optional)"}
                  </span>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                  >
                    <option value="">
                      {field.required ? "Select column…" : "— Skip —"}
                    </option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            {previewRows.length > 0 && (
              <div className="csv-mapper-preview">
                <h3>Preview</h3>
                <div className="table-wrap">
                  <table className="data-table csv-preview-table">
                    <thead>
                      <tr>
                        {headers.map((h) => (
                          <th key={h}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i}>
                          {headers.map((_, colIdx) => (
                            <td key={colIdx}>{row[colIdx] ?? ""}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-dark" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-amber"
            disabled={!canImport || importing}
            onClick={() => void handleImport()}
          >
            {importing ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
