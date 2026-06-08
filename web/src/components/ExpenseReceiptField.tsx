import { useRef } from "react";

import { getApiBase } from "../lib/apiBase.js";

const API_BASE = getApiBase();

function resolveReceiptSrc(receiptUrl: string | null | undefined, previewUrl: string | null | undefined): string | null {
  if (previewUrl) return previewUrl;
  if (!receiptUrl) return null;
  if (receiptUrl.startsWith("http://") || receiptUrl.startsWith("https://")) return receiptUrl;
  return `${API_BASE}${receiptUrl}`;
}

interface ExpenseReceiptFieldProps {
  receiptUrl: string | null;
  receiptPreview: string | null;
  uploading: boolean;
  onSelectFile: (file: File) => void;
  onRemove: () => void;
}

export function ExpenseReceiptField({
  receiptUrl,
  receiptPreview,
  uploading,
  onSelectFile,
  onRemove,
}: ExpenseReceiptFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const src = resolveReceiptSrc(receiptUrl, receiptPreview);

  return (
    <div className="jrv-receipt-field">
      <span className="jrv-field-label">Receipt photo (optional)</span>
      {src ? (
        <div className="jrv-receipt-preview-wrap">
          <img src={src} alt="Receipt preview" className="jrv-receipt-thumb" />
          <div className="jrv-receipt-actions">
            <button
              type="button"
              className="btn-dark jrv-receipt-btn"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? "Uploading..." : "Replace photo"}
            </button>
            <button
              type="button"
              className="btn-dark jrv-receipt-btn"
              disabled={uploading}
              onClick={onRemove}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="jrv-receipt-add btn-dark"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading receipt..." : "Add receipt photo"}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="jrv-receipt-input-hidden"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) onSelectFile(file);
          ev.target.value = "";
        }}
      />
    </div>
  );
}
