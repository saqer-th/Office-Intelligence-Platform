"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../contexts/AuthContext";
import { API_BASE_URL } from "../../../utils/api";

export default function VisitListDetail({ params }) {
    const [list, setList] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState(new Set());
    const router = useRouter();
    const { user, token } = useAuth();

    useEffect(() => {
        setLoading(true);

        fetch(`${API_BASE_URL}/visit-lists/${params.id}`)
            .then(r => {
                if (!r.ok) throw new Error("List not found");
                return r.json();
            })
            .then(listData => {
                setList(listData);
                return fetch(`${API_BASE_URL}/visit-lists/${params.id}/members`);
            })
            .then(r => r.json())
            .then(memberData => {
                setMembers(Array.isArray(memberData) ? memberData : []);
            })
            .catch(e => console.error(e))
            .finally(() => setLoading(false));
    }, [params.id]);

    const handleToggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === members.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(members.map(m => m.office_id)));
        }
    };

    const handleSendMessage = () => {
        const ids = Array.from(selectedIds).join(",");
        router.push(`/outreach?source=ids&ids=${ids}`);
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this list?")) return;
        try {
            const res = await fetch(`${API_BASE_URL}/visit-lists/${params.id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (res.ok) {
                alert("List deleted");
                router.push("/visits");
            } else {
                alert("Failed to delete list");
            }
        } catch (e) {
            alert("Error deleting list");
        }
    };

    if (loading) return <div className="p-12 text-center text-muted">Loading list details...</div>;
    if (!list) return <div className="p-12 text-center text-red-500">List not found</div>;

    const completedCount = members.filter(m => m.visit_status === "Completed").length;
    const progress = members.length > 0 ? Math.round((completedCount / members.length) * 100) : 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/visits" className="text-muted hover:text-ink">←</Link>
                    <div>
                        <h1 className="text-2xl font-bold text-ink">{list.name}</h1>
                        <p className="text-sm text-muted">{members.length} Offices • Created {new Date(list.created_at).toLocaleDateString()}</p>
                    </div>
                </div>
                {/* OLD BUTTON REMOVED for consistency 
                <Link href="/outreach" className="btn-secondary text-xs">
                    Run Batch Outreach
                </Link>
                */}
                {user?.role === 'Admin' && (
                    <button onClick={handleDelete} className="text-xs text-red-500 underline ml-4 hover:text-red-700">
                        Delete List
                    </button>
                )}
            </div>

            {/* Progress Bar */}
            <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex items-center gap-4">
                <div className="flex-1">
                    <div className="flex justify-between text-xs font-semibold mb-1">
                        <span>Progress</span>
                        <span>{completedCount} / {members.length} Visited</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-ink">{progress}%</div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-border overflow-hidden">
                {/* Action Bar */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-slate-50 min-h-[50px]">
                    {selectedIds.size > 0 ? (
                        <div className="flex items-center gap-3 w-full animate-in fade-in duration-200">
                            <span className="text-sm font-bold text-ink">{selectedIds.size} Selected</span>
                            <div className="h-4 w-px bg-slate-300"></div>
                            <button
                                onClick={handleSendMessage}
                                className="text-xs font-semibold text-green-700 hover:text-green-800 bg-green-50 px-2 py-1 rounded border border-green-200"
                            >
                                Send Message
                            </button>
                            <div className="flex-1"></div>
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="text-xs text-slate-500 hover:text-slate-800"
                            >
                                Clear
                            </button>
                        </div>
                    ) : (
                        <div className="flex justify-between w-full items-center">
                            <div className="text-xs text-muted font-medium">List Members ({members.length})</div>
                            <button
                                onClick={handleSelectAll}
                                className="text-xs text-primary font-medium hover:underline"
                            >
                                Select All
                            </button>
                        </div>
                    )}
                </div>

                {members.length === 0 && (
                    <div className="p-10 text-center text-muted">No offices in this list.</div>
                )}
                <ul className="divide-y divide-border">
                    {members.map(m => {
                        const isCompleted = m.visit_status === "Completed";
                        const isSelected = selectedIds.has(m.office_id);
                        return (
                            <li key={m.office_id}
                                className={`p-4 hover:bg-slate-50 flex justify-between items-start group ${isCompleted ? 'bg-green-50/30' : ''} ${isSelected ? 'bg-blue-50/30' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className="pt-1">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => handleToggleSelect(m.office_id)}
                                            className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <Link href={`/offices/${m.office_id}?back=/visits/${params.id}`} className="font-bold text-ink hover:underline">
                                                {m.office_name || `Office #${m.office_id}`}
                                            </Link>
                                            {isCompleted && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded border border-green-200">
                                                    ✓ Visited
                                                </span>
                                            )}
                                            {!isCompleted && (
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    Planned
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-muted mt-0.5">
                                            {m.city} • {m.district}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {isCompleted ? (
                                        <div className="mb-0.5">
                                            <span className="text-xs font-semibold text-ink">{m.last_visit_outcome}</span>
                                            <div className="text-[10px] text-muted">
                                                {new Date(m.last_visit_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400 italic">Pending</div>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
