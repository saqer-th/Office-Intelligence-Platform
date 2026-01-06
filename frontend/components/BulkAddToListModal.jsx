"use client";


import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";


const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function BulkAddToListModal({ selectedIds, onClose, onSuccess }) {
    const { token } = useAuth();
    const [lists, setLists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newListName, setNewListName] = useState("");
    const [creating, setCreating] = useState(false);

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

    const handleCreateAndAdd = async () => {
        if (!newListName.trim()) return;

        console.log("DEBUG: Creating List with token:", token); // Debug log
        if (!token) {
            alert("No authentication token found. Please log in again.");
            return;
        }

        setCreating(true);
        const base = API_BASE_URL || "http://localhost:8000";
        try {
            // 1. Create List
            const createRes = await fetch(`${base}/visit-lists`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ name: newListName })
            });

            if (!createRes.ok) {
                const err = await createRes.json();
                throw new Error(err.detail || "Failed to create list");
            }

            const newList = await createRes.json();

            // 2. Add Members
            await handleAdd(newList.id);
        } catch (e) {
            alert("Failed to create list: " + e.message);
            setCreating(false);
        }
    };

    const handleAdd = async (listId) => {
        const base = API_BASE_URL || "http://localhost:8000";
        try {
            const res = await fetch(`${base}/visit-lists/${listId}/members`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(selectedIds)
            });
            if (res.ok) {
                if (onSuccess) onSuccess();
                if (onClose) onClose();
                // alert(`Added ${selectedIds.length} offices to list.`); // Optional feedback
            } else {
                const err = await res.json();
                alert(`Failed: ${err.detail || "Unknown error"}`);
                setCreating(false); // Reset if failed at this stage
            }
        } catch (e) {
            alert("Failed to add to list");
            setCreating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-ink">Add to Visit List</h3>
                <p className="text-sm text-muted">Manage membership for {selectedIds.length} offices:</p>

                {/* Create New Section */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <label className="block text-xs font-bold text-muted uppercase mb-1">Create New List</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newListName}
                            onChange={(e) => setNewListName(e.target.value)}
                            placeholder="e.g. 'Riyadh North Sprint'"
                            className="flex-1 text-sm p-2 border border-slate-300 rounded focus:border-primary focus:outline-none"
                        />
                        <button
                            onClick={handleCreateAndAdd}
                            disabled={!newListName.trim() || creating}
                            className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 disabled:opacity-50 transition-colors"
                        >
                            {creating ? "..." : "Create"}
                        </button>
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-muted">Or Select Existing</span>
                    </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {loading && <p className="text-sm text-muted text-center">Loading lists...</p>}
                    {lists.length === 0 && !loading && <p className="text-sm text-muted text-center py-2">No active lists found.</p>}
                    {lists.map(l => (
                        <button
                            key={l.id}
                            onClick={() => handleAdd(l.id)}
                            className="w-full text-left p-3 hover:bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium flex justify-between group transition-colors"
                        >
                            <span className="group-hover:text-primary transition-colors">{l.name}</span>
                            <span className="text-slate-400 group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                    ))}
                </div>

                <button onClick={onClose} className="w-full py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">Cancel</button>
            </div>
        </div>
    );
}
