"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../contexts/AuthContext";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function VisitListsPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");

  const fetchLists = () => {
    setLoading(true);
    const base = API_BASE_URL || "http://localhost:8000";
    fetch(`${base}/visit-lists`)
      .then(res => res.json())
      .then(data => {
        setLists(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    if (!token) return alert("Please log in to create a list.");

    const base = API_BASE_URL || "http://localhost:8000";
    try {
      const res = await fetch(`${base}/visit-lists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name: newListName })
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewListName("");
        fetchLists();
      }
    } catch (e) {
      alert("Failed to create list");
    }
  };

  if (loading) return <div className="p-12 text-center text-muted">Loading lists...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink">Visit Planning</h1>
          <p className="text-muted">Manage your persistent visit lists.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary"
        >
          + New List
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {lists.length === 0 && (
          <div className="col-span-2 text-center py-20 bg-white border border-dashed rounded-xl border-slate-300">
            <div className="text-4xl mb-2">📋</div>
            <p className="text-muted">No lists found. Create your first plan.</p>
          </div>
        )}
        {lists.map(lst => (
          <Link key={lst.id} href={`/visits/${lst.id}`} className="block">
            <div className="bg-white p-6 rounded-xl border border-border hover:shadow-md transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-ink group-hover:text-primary transition-colors">{lst.name}</h3>
                  <p className="text-sm text-muted mt-1">Created {new Date(lst.created_at).toLocaleDateString()}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:bg-primary/5">
                  →
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-bold">New Visit List</h3>
            <div>
              <label className="block text-xs font-bold text-muted uppercase mb-1">List Name</label>
              <input
                autoFocus
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                className="w-full border p-2 rounded-lg text-sm"
                placeholder="e.g. Riyadh North Run"
                onKeyDown={e => e.key === 'Enter' && handleCreateList()}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-2 text-slate-600 font-medium hover:bg-slate-50 rounded-lg">Cancel</button>
              <button onClick={handleCreateList} className="flex-1 py-2 bg-primary text-white font-medium rounded-lg hover:opacity-90">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
