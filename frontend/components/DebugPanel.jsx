"use client";

import { useState } from "react";

export default function DebugPanel({ title, apiBaseUrl, lastResponse, error }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!process.env.NEXT_PUBLIC_DEBUG_MODE && process.env.NODE_ENV === 'production') {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`text-xs px-2 py-1 rounded shadow-sm border ${error ? "bg-red-50 text-red-600 border-red-200" : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                >
                    {isOpen ? "Hide Debug" : error ? "Debug (Error)" : "Debug"}
                </button>
            </div>

            {isOpen && (
                <div className="mt-2 w-80 max-h-96 overflow-auto rounded-lg border border-border bg-white p-4 shadow-xl pointer-events-auto text-xs font-mono">
                    <div className="mb-2 font-bold text-ink border-b border-border pb-1">{title || "Debug"}</div>

                    <div className="space-y-3">
                        <div>
                            <div className="text-muted">API Base:</div>
                            <div className="break-all text-slate-700">{apiBaseUrl || "Not Set"}</div>
                        </div>

                        {error && (
                            <div className="p-2 bg-red-50 rounded border border-red-100 text-red-700">
                                <div className="font-semibold">Error:</div>
                                <div className="break-words">{error}</div>
                            </div>
                        )}

                        {lastResponse && (
                            <div>
                                <div className="text-muted mb-1">Last Response:</div>
                                <pre className="bg-slate-50 p-2 rounded border border-slate-100 overflow-x-auto text-[10px]">
                                    {JSON.stringify(lastResponse, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
