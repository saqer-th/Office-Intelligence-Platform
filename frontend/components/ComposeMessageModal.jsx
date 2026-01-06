import { useState } from "react";
import { API_BASE_URL } from "../utils/api";

export default function ComposeMessageModal({
    selectedIds = [],
    onClose,
    onSuccess
}) {
    const [body, setBody] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null); // { sent_count, skipped_count, ... }
    const [force, setForce] = useState(false);

    // If we have selected IDs (Set or Array), normalize to Array
    const recipientIds = Array.from(selectedIds);

    const handleSend = async () => {
        if (!body.trim()) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/messages/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    office_ids: recipientIds,
                    body: body,
                    force: force
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || "Failed to send");

            setResult(data);
            if (onSuccess) onSuccess(data);
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (result) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
                    <div className="text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600 text-2xl">
                            ✓
                        </div>
                        <h2 className="text-lg font-bold text-ink">Messages Queued</h2>
                        <div className="mt-2 text-sm text-muted space-y-1">
                            <p>Successfully sent: <span className="font-semibold text-ink">{result.sent_count}</span></p>
                            {result.skipped_count > 0 && (
                                <p className="text-amber-600">
                                    Skipped {result.skipped_count} (Recent contact)
                                </p>
                            )}
                        </div>
                        <div className="mt-6">
                            <button
                                onClick={onClose}
                                className="w-full rounded-lg bg-slate-100 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-ink">Compose Message</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-ink">✕</button>
                </div>

                <div className="mb-4">
                    <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                        To: {recipientIds.length} Recipients
                    </div>
                    {/* Optional: Show first few names if we passed full objects, but we only calculate count for now */}

                    <textarea
                        className="w-full rounded-lg border border-border bg-slate-50 p-3 text-sm focus:border-primary focus:outline-none min-h-[150px]"
                        placeholder="Type your message here..."
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                    />
                </div>

                <div className="mb-6 flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="force"
                        checked={force}
                        onChange={(e) => setForce(e.target.checked)}
                        className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="force" className="text-xs text-muted select-none">
                        Force send (ignore recent contact safety check)
                    </label>
                </div>

                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={loading || !body.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <div className="animate-spin h-3 w-3 border-2 border-white border-r-transparent rounded-full"></div>}
                        Send Message
                    </button>
                </div>
            </div>
        </div>
    );
}
