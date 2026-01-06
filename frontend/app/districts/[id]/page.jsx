"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OfficeList from "../../../components/OfficeList";
import BulkAddToListModal from "../../../components/BulkAddToListModal";
import { API_BASE_URL } from "../../../utils/api";

export default function DistrictDetailPage({ params }) {
    const router = useRouter();
    const districtName = decodeURIComponent(params.id);

    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Selection for Planning
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [showAddToList, setShowAddToList] = useState(false);

    useEffect(() => {
        if (!districtName) return;
        setLoading(true);

        const params = new URLSearchParams({
            district: districtName,
            limit: "100" // Maybe increase for full district view
        });

        fetch(`${API_BASE_URL}/offices?${params.toString()}`)
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error("Failed to load district offices");
                setOffices(Array.isArray(data.data) ? data.data : []);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
    }, [districtName]);

    const handleToggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === offices.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(offices.map(o => o.id)));
        }
    };

    const handleSendMessage = () => {
        const ids = Array.from(selectedIds).join(",");
        router.push(`/outreach?source=ids&ids=${ids}`);
    };

    // Derived Stats
    const interestedCount = offices.filter(o => o.interest_status === "Interested" || o.contact_status === "Interested").length;
    const visitedCount = offices.filter(o => o.contact_status === "Visited").length;

    if (loading) return <div className="p-8 text-center text-muted">Loading district details...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted">
                    <Link href="/groups" className="hover:text-ink">Groups</Link>
                    <span>/</span>
                    <span className="text-ink font-medium">{districtName}</span>
                </div>
                <Link href="/groups" className="text-sm font-medium text-muted hover:text-ink">
                    ← Back to Overview
                </Link>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                {/* Main Column */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-bold text-ink">{districtName}</h1>
                                <p className="text-muted">Strict District View</p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-xs font-bold border bg-slate-50 text-slate-600 border-slate-200">
                                STRICT GROUP
                            </span>
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
                                        onClick={() => setShowAddToList(true)}
                                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                                    >
                                        + Add to Visit List
                                    </button>
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
                                    <h2 className="text-sm font-semibold text-muted">Offices ({offices.length})</h2>
                                    <button
                                        onClick={handleSelectAll}
                                        className="text-xs text-primary font-medium hover:underline"
                                    >
                                        Select All
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="p-2">
                            <OfficeList
                                offices={offices}
                                selectedIds={selectedIds}
                                onToggleSelect={handleToggleSelect}
                                loading={loading}
                                onFocus={() => { }}
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="space-y-6">
                    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                        <h3 className="font-semibold text-sm mb-4">District Stats</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Interested</span>
                                <span className="font-medium">{interestedCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Total Offices</span>
                                <span className="font-medium">{offices.length}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted">Visited</span>
                                <span className="font-medium">{visitedCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showAddToList && (
                <BulkAddToListModal
                    selectedIds={Array.from(selectedIds)}
                    onClose={() => setShowAddToList(false)}
                    onSuccess={() => {
                        setSelectedIds(new Set());
                    }}
                />
            )}
        </div>
    );
}
