"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function OutreachBoardPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const base = API_BASE_URL || "http://localhost:8000";
        fetch(`${base}/outreach/board`)
            .then(res => {
                if (!res.ok) throw new Error("Failed to load board data");
                return res.json();
            })
            .then(setData)
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-12 text-center text-muted">Loading board...</div>;
    if (error) return <div className="p-12 text-center text-red-500">Error: {error}</div>;

    const columns = [
        { id: "visited", title: "Visited", color: "bg-green-50 border-green-200" },
        { id: "contacted", title: "Contacted", color: "bg-blue-50 border-blue-200" },
        { id: "planned", title: "Planned", color: "bg-purple-50 border-purple-200" },
        { id: "cold", title: "Cold", color: "bg-slate-50 border-slate-200" },
        { id: "stale", title: "Stale", color: "bg-orange-50 border-orange-200" }
    ];

    return (
        <div className="h-screen flex flex-col bg-white">
            <div className="p-6 border-b border-border flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Outreach Status Board</h1>
                    <p className="text-muted text-sm">Operational view of market penetration.</p>
                </div>
                <Link href="/outreach" className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                    Go to Batch Sender
                </Link>
            </div>

            <div className="flex-1 overflow-x-auto p-6">
                <div className="flex gap-6 h-full min-w-max">
                    {columns.map(col => {
                        const items = data[col.id] || [];
                        return (
                            <div key={col.id} className={`w-80 flex flex-col rounded-xl border ${col.color} bg-opacity-50 h-full`}>
                                <div className="p-4 border-b border-black/5 flex justify-between items-center">
                                    <h3 className="font-bold text-ink">{col.title}</h3>
                                    <span className="text-xs font-mono bg-white/50 px-2 py-1 rounded">{items.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {items.map(office => (
                                        <Link key={office.id} href={`/offices/${office.id}`} className="block">
                                            <div className="bg-white p-3 rounded-lg shadow-sm border border-black/5 hover:shadow-md transition-all">
                                                <div className="font-medium text-ink truncate">{office.name}</div>
                                                <div className="text-xs text-muted flex justify-between mt-2">
                                                    <span>{office.city}</span>
                                                    <span>{office.district}</span>
                                                </div>
                                                {office.last_visit_at && (
                                                    <div className="mt-2 text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                                                        Confirmed {new Date(office.last_visit_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {!office.last_visit_at && office.last_message_at && (
                                                    <div className="mt-2 text-[10px] text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
                                                        Msg {new Date(office.last_message_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                                {office.visit_lists && office.visit_lists.length > 0 && (
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {office.visit_lists.map(L => (
                                                            <span key={L} className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">{L}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </Link>
                                    ))}
                                    {items.length === 0 && (
                                        <div className="text-center text-xs text-muted py-10 opacity-50">Empty</div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
