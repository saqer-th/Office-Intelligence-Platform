"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBadge from "../../../components/StatusBadge";
import ComposeMessageModal from "../../../components/ComposeMessageModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

export default function OfficeDetailPage({ params }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const backUrl = searchParams.get("back") || "/list";

  const [office, setOffice] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visits, setVisits] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("timeline");
  const [visitList, setVisitList] = useState([]);
  const [showCompose, setShowCompose] = useState(false);

  // Edit State
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);

  // List Membership State
  const [showListModal, setShowListModal] = useState(false);
  const [activeLists, setActiveLists] = useState([]); // List IDs this office is in

  useEffect(() => {
    // Check membership on load
    const base = API_BASE_URL || "http://localhost:8000";
    if (params?.id) {
      // Ideally we have an endpoint /offices/{id}/lists, but for now we can infer from /outreach/board data or just fetch all lists and check members? 
      // Or simpler: GET /visit-lists, then for each check membership? No, too many requests.
      // Better: New Endpoint `GET /offices/{id}/visit-lists`.
      // For now, let's implement the Modal to load status on open, rather than eager load. 
      // Just show "+ Add to List" (generic).
    }
  }, [params]);

  const fetchOfficeData = () => {
    if (!params?.id) return;
    const base = API_BASE_URL || "http://localhost:8000";

    setLoading(true);
    Promise.all([
      fetch(`${base}/offices/${params.id}`).then(r => r.json()),
      fetch(`${base}/offices/${params.id}/messages`).then(r => r.json()),
      fetch(`${base}/visits?office_id=${params.id}`).then(r => r.json()),
      fetch(`${base}/offices/${params.id}/activities`).then(r => r.ok ? r.json() : []) // Swallow 404 if not yet implemented/empty
    ])
      .then(([officeData, msgData, visitData, activityData]) => {
        if (officeData.detail) throw new Error(officeData.detail);
        setOffice(officeData);
        setMessages(Array.isArray(msgData.data) ? msgData.data : []);
        setVisits(Array.isArray(visitData) ? visitData : []);
        setActivities(Array.isArray(activityData) ? activityData : []);
        setNotes(officeData.notes || "");
        setError(null);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOfficeData();
  }, [params]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      const base = API_BASE_URL || "http://localhost:8000";
      const res = await fetch(`${base}/offices/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interest_status: newStatus })
      });
      if (res.ok) {
        fetchOfficeData(); // Reload to confirm
      }
    } catch (e) {
      alert("Failed to update status");
    }
  };

  const handleNotesSave = async () => {
    try {
      const base = API_BASE_URL || "http://localhost:8000";
      await fetch(`${base}/offices/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes })
      });
      setIsEditingNotes(false);
      fetchOfficeData();
    } catch (e) {
      alert("Failed to save notes");
    }
  };

  const openListModal = () => {
    setShowListModal(true);
  };

  const timelineEvents = [
    ...messages.map(m => ({ type: 'message', date: new Date(m.created_at), data: m })),
    ...visits.map(v => ({ type: 'visit', date: new Date(v.completed_at || v.scheduled_at || v.created_at), data: v })),
    ...activities.map(a => ({ type: 'activity', date: new Date(a.created_at), data: a })),
    ...(office?.last_contact_date ? [{ type: 'contact', date: new Date(office.last_contact_date), data: { note: 'Last recorded contact' } }] : [])
  ].sort((a, b) => b.date - a.date);

  if (loading) return <div className="p-12 text-center text-muted">Loading office profile...</div>;
  if (!office) return <div className="p-12 text-center text-red-500">Office not found</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* Top Nav */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-2 text-muted">
          <Link href={backUrl} className="hover:text-ink">List</Link> /
          <span className="text-ink font-medium">{office.name}</span>
        </div>
        <Link href={backUrl} className="text-muted hover:text-ink">← Back to List</Link>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-ink mb-1">{office.name}</h1>
            <p className="text-muted text-lg">{office.district} • {office.city}</p>
            <div className="flex items-center gap-3 mt-4">
              <StatusBadge status={office.interest_status || "New"} />

              {/* Derived Visit Status */}
              {(() => {
                const completedVisit = visits.find(v => ["Completed", "completed", "Visited"].includes(v.status));
                const plannedVisit = visits.find(v => ["Planned", "planned", "Pending"].includes(v.status));

                if (completedVisit) {
                  return (
                    <span className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded border border-green-200">
                      <span>✓ Visited</span>
                      <span className="opacity-75 font-normal">
                        {new Date(completedVisit.completed_at || completedVisit.scheduled_at).toLocaleDateString()}
                      </span>
                    </span>
                  );
                } else if (plannedVisit) {
                  return (
                    <span className="flex items-center gap-1 text-xs font-semibold bg-purple-100 text-purple-700 px-2 py-1 rounded border border-purple-200">
                      <span>⏳ Visit Planned</span>
                    </span>
                  );
                } else {
                  return (
                    <span className="flex items-center gap-1 text-xs font-semibold bg-slate-100 text-slate-500 px-2 py-1 rounded border border-slate-200">
                      <span>Never Visited</span>
                    </span>
                  );
                }
              })()}

              {office.priority_score && (
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded">
                  Priority: {Math.round(office.priority_score)}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col items-end gap-3">
            <button
              onClick={openListModal}
              className="px-4 py-2 rounded-lg font-medium text-sm transition-all bg-primary text-white shadow-md hover:bg-primary/90"
            >
              Manage Lists
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowVisitModal(true)}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-purple-600 text-white hover:bg-purple-700 shadow-md flex items-center gap-2"
              >
                <span>📍 Mark Visited</span>
              </button>
              {office.phone && (
                <a href={`https://wa.me/${office.phone.replace(/[^0-9]/g, '')}`} target="_blank" className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 border border-green-200" title="WhatsApp">
                  💬
                </a>
              )}
              {office.phone && (
                <a href={`tel:${office.phone}`} className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200" title="Call">
                  📞
                </a>
              )}
              {office.google_maps_url && (
                <a href={office.google_maps_url} target="_blank" className="p-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200" title="Maps">
                  📍
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Quick Actions / Status */}
          <div className="p-4 bg-slate-50 border border-border rounded-xl flex flex-wrap gap-4 items-center justify-between">
            <span className="text-sm font-medium text-muted uppercase tracking-wide">Update Status:</span>
            <div className="flex gap-2">
              {['Interested', 'Later', 'Rejected', 'Onboarded'].map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  className={`px-3 py-1.5 rounded text-sm border ${office.interest_status === status ? 'bg-ink text-white border-ink' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-border flex gap-6 text-sm font-medium text-muted">
            <button onClick={() => setActiveTab('timeline')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'timeline' ? 'text-primary border-primary' : 'border-transparent hover:text-ink'}`}>Timeline</button>
            <button onClick={() => setActiveTab('messages')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'messages' ? 'text-primary border-primary' : 'border-transparent hover:text-ink'}`}>Messages</button>
            <button onClick={() => setActiveTab('details')} className={`pb-3 border-b-2 transition-colors ${activeTab === 'details' ? 'text-primary border-primary' : 'border-transparent hover:text-ink'}`}>Details</button>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {activeTab === 'timeline' && (
              <div className="space-y-6">

                {/* Quick Log Input */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-ink mb-2">Quick Log</h4>
                  <div className="flex gap-2">
                    <select
                      className="h-9 rounded-md border border-slate-300 text-sm bg-white px-2 focus:border-primary focus:outline-none"
                      id="log-type"
                    >
                      <option value="Note">Note</option>
                      <option value="Call">Call</option>
                      <option value="Email">Email</option>
                      <option value="Visit">Visit</option>
                    </select>
                    <input
                      className="flex-1 h-9 rounded-md border border-slate-300 text-sm bg-white px-3 focus:border-primary focus:outline-none"
                      placeholder="Add a note to the timeline..."
                      id="log-note"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const type = document.getElementById('log-type').value;
                          const note = e.target.value;
                          if (!note.trim()) return;

                          // Optimistic update or fetch
                          const base = API_BASE_URL || "http://localhost:8000";
                          fetch(`${base}/offices/${params.id}/activities`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ activity_type: type, notes: note, outcome: "Completed" })
                          }).then(() => {
                            e.target.value = "";
                            fetchOfficeData();
                          });
                        }
                      }}
                    />
                    <button
                      className="px-4 h-9 bg-slate-900 text-white rounded-md text-sm font-medium hover:bg-slate-800"
                      onClick={() => {
                        const noteInput = document.getElementById('log-note');
                        const typeInput = document.getElementById('log-type');
                        const note = noteInput.value;
                        const type = typeInput.value;

                        if (!note.trim()) return;

                        const base = API_BASE_URL || "http://localhost:8000";
                        fetch(`${base}/offices/${params.id}/activities`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ activity_type: type, notes: note, outcome: "Completed" })
                        }).then(() => {
                          noteInput.value = "";
                          fetchOfficeData();
                        });
                      }}
                    >
                      Log
                    </button>
                  </div>
                </div>

                {timelineEvents.length === 0 && (
                  <div className="text-center py-10 text-muted">No history yet.</div>
                )}
                {timelineEvents.map((event, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${event.type === 'visit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {event.type === 'visit' ? '📍' : '💬'}
                      </div>
                      {i !== timelineEvents.length - 1 && <div className="w-0.5 flex-1 bg-slate-100 my-1"></div>}
                    </div>
                    <div className="pb-6">
                      <div className="text-xs text-muted mb-1">
                        {event.date.toLocaleDateString()} at {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="bg-white border border-border p-3 rounded-lg shadow-sm text-sm">
                        {event.type === 'visit' && (
                          <div className={`border-l-4 pl-3 ${event.data.outcome === 'Interested' || event.data.outcome === 'Onboarded' ? 'border-green-500' : 'border-slate-300'}`}>
                            <span className="font-semibold text-ink">Visit Completed</span>
                            <div className="text-xs text-muted mb-2">Outcome: <span className="font-medium text-ink">{event.data.outcome}</span></div>
                            {event.data.notes && <p className="text-slate-700 text-sm whitespace-pre-wrap">{event.data.notes}</p>}
                          </div>
                        )}
                        {event.type === 'message' && (
                          <div>
                            <span className="font-semibold uppercase text-xs text-muted mb-1 block">{event.data.direction}</span>
                            <p className="text-slate-800">{event.data.body}</p>
                          </div>
                        )}
                        {event.type === 'activity' && (
                          <div>
                            <span className="font-semibold text-sm block mb-1">
                              {event.data.activity_type === 'Note' ? '📝 Note' :
                                event.data.activity_type === 'Call' ? '📞 Call Log' :
                                  event.data.activity_type === 'Email' ? '📧 Email Log' :
                                    event.data.activity_type === 'Visit' ? '📍 Visit Log' : 'Activity'}
                            </span>
                            <p className="text-slate-700 whitespace-pre-wrap">{event.data.notes}</p>
                          </div>
                        )}
                        {event.type === 'contact' && (
                          <p>Manual contact recorded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'messages' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-ink">Message History</h3>
                  <button
                    onClick={() => setShowCompose(true)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800"
                  >
                    Send Message
                  </button>
                </div>

                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-10 text-muted bg-slate-50 rounded-lg border border-dashed border-slate-200">
                      No messages found. Start a conversation!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`flex gap-4 ${msg.direction === 'Outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-xl p-4 shadow-sm text-sm border ${msg.direction === 'Outbound'
                          ? 'bg-blue-50 border-blue-100 text-slate-800 rounded-tr-none'
                          : 'bg-white border-slate-200 text-slate-800 rounded-tl-none'
                          }`}>
                          <div className="flex justify-between items-center gap-4 mb-2">
                            <span className={`text-xs font-semibold uppercase ${msg.direction === 'Outbound' ? 'text-blue-600' : 'text-slate-500'}`}>
                              {msg.direction}
                            </span>
                            <span className="text-xs text-muted">
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.body}</p>
                          <div className="mt-2 text-right">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${msg.status === 'Sent' ? 'bg-slate-200 text-slate-600' :
                              msg.status === 'Replied' ? 'bg-green-100 text-green-700' :
                                'bg-red-50 text-red-600'
                              }`}>
                              {msg.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="grid gap-4 bg-white p-6 rounded-xl border border-border">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="block text-xs text-muted uppercase">Phone</label>
                    <div className="font-medium mt-1">{office.phone || "N/A"}</div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted uppercase">Rating</label>
                    <div className="font-medium mt-1">{office.rating} ({office.rating_count} reviews)</div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted uppercase">Group</label>
                    <div className="font-medium mt-1">
                      {office.group_name ? <Link href={`/groups/${office.group_id}`} className="text-primary hover:underline">{office.group_name}</Link> : "None"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted uppercase">Grid ID</label>
                    <div className="font-medium mt-1 font-mono">{office.grid_id || "-"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-sm">Notes</h3>
              {!isEditingNotes && (
                <button onClick={() => setIsEditingNotes(true)} className="text-xs text-primary hover:underline">Edit</button>
              )}
            </div>
            {isEditingNotes ? (
              <div className="space-y-2">
                <textarea
                  className="w-full text-sm p-3 border border-border rounded-lg min-h-[100px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add internal notes..."
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditingNotes(false)} className="px-3 py-1 text-xs text-muted hover:text-ink">Cancel</button>
                  <button onClick={handleNotesSave} className="px-3 py-1 text-xs bg-primary text-white rounded hover:bg-primary/90">Save</button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600 whitespace-pre-wrap min-h-[50px]">
                {notes || <span className="text-muted italic">No notes added.</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCompose && (
        <ComposeMessageModal
          selectedIds={[office.id]}
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            fetchOfficeData(); // Refresh messages
            setActiveTab('messages'); // Switch to messages tab
          }}
        />
      )}

      {showVisitModal && (
        <RecordVisitModal
          officeId={office.id}
          onClose={() => setShowVisitModal(false)}
          onSuccess={() => {
            fetchOfficeData();
            setActiveTab('timeline');
          }}
        />
      )}

      {showListModal && (
        <ListMembershipModal
          officeId={office.id}
          onClose={() => setShowListModal(false)}
        />
      )}
    </div>
  );
}

function ListMembershipModal({ officeId, onClose }) {
  const [lists, setLists] = useState([]);
  const [membershipMap, setMembershipMap] = useState({}); // list_id -> boolean
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const base = API_BASE_URL || "http://localhost:8000";
    Promise.all([
      fetch(`${base}/visit-lists`).then(r => r.json()),
      fetch(`${base}/offices/${officeId}/visit-lists`).then(r => r.json())
    ]).then(([allLists, myLists]) => {
      setLists(allLists);
      const map = {};
      if (Array.isArray(myLists)) {
        myLists.forEach(l => map[l.id] = true);
      }
      setMembershipMap(map);
      setLoading(false);
    });
  }, [officeId]);

  const toggle = async (listId, currentStatus) => {
    const base = API_BASE_URL || "http://localhost:8000";
    if (!currentStatus) {
      // Add
      await fetch(`${base}/visit-lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([officeId])
      });
      setMembershipMap(prev => ({ ...prev, [listId]: true }));
    } else {
      // Remove - Not implemented in backend yet! DELETE /visit-lists/{id}/members/{officeId}
      alert("Removal not supported yet in API (Safety).");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-lg font-bold">Manage Lists</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {loading && <p>Loading...</p>}
          {!loading && lists.map(l => (
            <div key={l.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded">
              <span>{l.name}</span>
              <button
                onClick={() => !membershipMap[l.id] && toggle(l.id, membershipMap[l.id])}
                className={`text-xs px-2 py-1 rounded border ${membershipMap[l.id] ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-default' : 'bg-white border-slate-300 hover:bg-slate-100'}`}
                disabled={membershipMap[l.id]}
              >
                {membershipMap[l.id] ? "In List" : "Add"}
              </button>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2 bg-slate-100 rounded text-sm font-medium">Close</button>
      </div>
    </div>
  );
}

function RecordVisitModal({ officeId, onClose, onSuccess }) {
  const [outcome, setOutcome] = useState("Interested");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); // Default today
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!outcome) return alert("Outcome is required");
    setLoading(true);
    const base = API_BASE_URL || "http://localhost:8000";

    try {
      // Atomic Visit Completion
      await fetch(`${base}/visits/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_id: officeId,
          outcome: outcome,
          notes: notes,
          date: new Date(date).toISOString()
        })
      });

      onSuccess();
      onClose();
    } catch (e) {
      alert("Failed to record visit: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h3 className="text-xl font-bold text-ink">Record Visit</h3>

        <div>
          <label className="block text-xs font-bold text-muted uppercase mb-1">Outcome</label>
          <div className="grid grid-cols-2 gap-2">
            {['Interested', 'Not Interested', 'Follow-up', 'Onboarded'].map(o => (
              <button
                key={o}
                onClick={() => setOutcome(o)}
                className={`py-2 px-3 rounded-lg text-sm border font-medium transition-all ${outcome === o ? 'bg-primary text-white border-primary shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
              >
                {o}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted uppercase mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full text-sm p-2 border border-slate-300 rounded-lg"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted uppercase mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full text-sm p-3 border border-slate-300 rounded-lg min-h-[80px]"
            placeholder="Meeting summary..."
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-slate-600 font-medium text-sm hover:bg-slate-50 rounded-lg" disabled={loading}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 bg-primary text-white font-medium text-sm rounded-lg hover:bg-primary/90 shadow-sm" disabled={loading}>
            {loading ? 'Saving...' : 'Save Visit'}
          </button>
        </div>
      </div>
    </div>
  );
}
