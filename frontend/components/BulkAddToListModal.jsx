"use client";

import { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function BulkAddToListModal({ selectedIds, onClose, onSuccess }) {
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const base = API_BASE_URL || "http://localhost:8000";
        fetch(`${base}/visit-lists`)
            .then(r => r.json())
            .then(data => {
                setLists(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const handleAdd = async (listId) => {
        const base = API_BASE_URL || "http://localhost:8000";
        try {
            const res = await fetch(`${base}/visit-lists/${listId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(selectedIds)
            });
            if (res.ok) {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
                alert(`Added ${selectedIds.length} offices to list.`);
            } else {
                const err = await res.json();
                alert(`Failed: ${err.detail || "Unknown error"}`);
            }
        } catch (e) {
            alert("Failed to add to list");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
                <h3 className="text-lg font-bold">Add to Visit List</h3>
                <p className="text-sm text-muted">Select a list to add {selectedIds.length} offices to:</p>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {loading && <p>Loading lists...</p>}
                    {lists.length === 0 && !loading && <p className="text-sm text-red-500">No lists found. Create one first.</p>}
                    {lists.map(l => (
                        <button
                            key={l.id}
                            onClick={() => handleAdd(l.id)}
                            className="w-full text-left p-3 hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium flex justify-between"
                        >
                            <span>{l.name}</span>
                            <span className="text-slate-400">→</span>
                        </button>
                    ))}
                </div>

                <button onClick={onClose} className="w-full py-2 bg-slate-100 rounded text-sm font-medium">Cancel</button>
            </div>
        </div>
    );
}
