import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/context/ToastContext";
import { formatDateTime } from "@/lib/format";

interface NoteRow {
  id: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export function StrategicNotesPage() {
  const { showToast } = useToast();
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ notes: NoteRow[] }>("/api/strategic-notes");
      setNotes(res.notes);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load notes", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this strategic note?")) return;
    try {
      await api.delete(`/api/strategic-notes/${id}`);
      showToast("Note removed", "success");
      void load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  };

  return (
    <div className="page activity-page">
      <div className="page-header-row">
        <h1>Strategic Notes</h1>
        <Link to="/jarvis" className="btn-dark">
          Log via JARVIS
        </Link>
      </div>
      <p className="text-muted activity-page-intro">
        Owner-level strategy and planning captured from JARVIS brain dumps.
      </p>

      {loading && <p className="text-muted">Loading...</p>}
      {!loading && notes.length === 0 && (
        <EmptyState
          icon="💡"
          title="No strategic notes yet"
          description="Tell JARVIS a big-picture idea and it will appear here after you approve the brain dump."
          ctaLabel="Log via JARVIS"
          ctaTo="/jarvis"
        />
      )}
      {!loading && notes.length > 0 && (
        <ul className="activity-list">
          {notes.map((n) => (
            <li key={n.id} className="activity-card">
              <p className="activity-card-title activity-note-body">{n.content}</p>
              <div className="activity-card-meta text-muted">
                <span>{formatDateTime(n.createdAt)}</span>
              </div>
              {n.tags.length > 0 && (
                <div className="activity-tags">
                  {n.tags.map((tag) => (
                    <span key={tag} className="activity-badge">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="activity-card-actions">
                <button
                  type="button"
                  className="btn-dark btn-sm"
                  onClick={() => void handleDelete(n.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
