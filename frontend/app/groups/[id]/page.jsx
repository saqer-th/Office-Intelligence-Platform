"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OfficeList from "../../../components/OfficeList";
import StatusBadge from "../../../components/StatusBadge";
import BulkAddToListModal from "../../../components/BulkAddToListModal";
import { API_BASE_URL } from "../../../utils/api";

const MESSAGING_BASE_URL = process.env.NEXT_PUBLIC_MESSAGING_BASE_URL;

export default function GroupDetailPage({ params }) {
  const router = useRouter();
  const [group, setGroup] = useState(null);
  const [offices, setOffices] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // New States
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showAddToList, setShowAddToList] = useState(false);

  // (Removed legacy localStorage useEffects)

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/groups/${params.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.detail || "Failed to load group");
        setGroup(data);
        setOffices(Array.isArray(data.offices) ? data.offices : []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params]);

  const handleToggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSendMessage = async () => {
    if (!MESSAGING_BASE_URL || messageText.trim() === "" || offices.length === 0) return;
    // Implementation would go here - confusing UX currently to message from here without feedback
    // Keeping simple for now
    alert("Message sent to group (Mock)");
    setMessageText("");
  };

  if (loading) return <div className="p-8 text-center text-muted">Loading group details...</div>;
  if (!group) return <div className="p-8 text-center text-red-500">Group not found</div>;

  const isReady = group.status === "ReadyForVisit";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Link href="/groups" className="hover:text-ink">Groups</Link>
          <span>/</span>
          <span className="text-ink font-medium">{group.group_name}</span>
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
                <h1 className="text-2xl font-bold text-ink">{group.group_name}</h1>
                <p className="text-muted">{group.district} • {group.city}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isReady ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                {isReady ? "READY FOR VISIT" : "MONITORING"}
              </span>
            </div>

            <div className="mt-6 flex gap-4">
              {selectedIds.size > 0 ? (
                <button
                  onClick={() => setShowAddToList(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <span>Add {selectedIds.size} Selected to List</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    // Select all
                    const allIds = new Set(offices.map(o => o.id));
                    setSelectedIds(allIds);
                    // Then open modal (or timeout to let state update? Better: pass explicit ids to modal or updating state triggers opens)
                    // Simplest: just set state and show modal? 
                    // actually better: pass ids to modal directly or modal uses selectedIds.
                    // Let's just set selectedIds and open modal next render? 
                    // No, state updates are batched/fast enough usually, or use `setShowAddToList(true)` directly.
                    // Wait, if I set state and open modal in same handler, modal render will see updated state.
                    setShowAddToList(true);
                  }}
                  className="btn-primary"
                >
                  Add All {offices.length} to Visit List
                </button>
              )}

              <button className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-slate-50">
                Edit Group
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Offices in Group ({offices.length})</h2>
            <OfficeList
              offices={offices}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onFocus={() => { }} // No map here for now
              loading={loading}
            />
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Group Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Interested</span>
                <span className="font-medium">{group.interested_count}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Total Offices</span>
                <span className="font-medium">{group.total_offices}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Priority Score</span>
                <span className="font-medium">{group.priority_score ? Math.round(group.priority_score) : 0}</span>
              </div>
              <hr className="border-slate-100" />
              <div className="flex justify-between text-sm">
                <span className="text-muted">Grid ID</span>
                <span className="font-mono text-xs">{group.grid_id}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Playbook</h3>
            <div className="relative pl-4 space-y-6 border-l-2 border-slate-100">
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-white"></div>
                <p className="text-xs uppercase text-muted font-semibold">Current Step</p>
                <p className="text-sm font-medium mt-0.5">{group.playbook_step || "Identify Group"}</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-slate-200 ring-4 ring-white"></div>
                <p className="text-xs uppercase text-muted font-semibold">Next Action</p>
                <p className="text-sm text-slate-600 mt-0.5">{group.playbook_next_action || "None"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {
        showAddToList && (
          <BulkAddToListModal
            selectedIds={Array.from(selectedIds)}
            onClose={() => setShowAddToList(false)}
            onSuccess={() => {
              setSelectedIds(new Set());
            }}
          />
        )
      }
    </div >
  );
}
