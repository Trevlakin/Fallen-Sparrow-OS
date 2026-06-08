export function OfflinePage() {
  return (
    <div className="offline-page">
      <div className="offline-card">
        <span className="wordmark-sm">FALLEN SPARROW</span>
        <h1>You are offline</h1>
        <p className="text-muted">
          Check your connection and try again. JARVIS drafts are saved locally when
          available.
        </p>
        <button
          type="button"
          className="btn-amber"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    </div>
  );
}
