"use client";

export default function DebugPanel({ title, apiBaseUrl, lastResponse, error }) {
  return (
    <div className="rounded-xl border border-dashed border-black/10 bg-panel p-4 text-xs text-muted">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-2">API base: {apiBaseUrl || "unset"}</div>
      {error && (
        <div className="mt-2 text-red-600">Error: {String(error)}</div>
      )}
      {lastResponse && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-[11px] text-ink">
          {JSON.stringify(lastResponse, null, 2)}
        </pre>
      )}
    </div>
  );
}
