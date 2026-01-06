"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const TEMPLATES = [
  {
    id: "intro",
    label: "Introduction",
    text: "Hello [Name], this is [Your Name] from OOMI. We would like to discuss a partnership opportunity with your office. Are you available for a brief call?"
  },
  {
    id: "visit",
    label: "Visit Request",
    text: "Hi [Name], we represent OOMI. We are in [District] today and would love to stop by your office for 5 minutes. Is that okay?"
  },
  {
    id: "followup",
    label: "Follow Up",
    text: "Hello [Name], following up on our visit earlier. Did you have a chance to review the proposal? Thanks, OOMI Team."
  }
];

function OutreachContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Context State
  const source = searchParams.get("source"); // 'visit_list', 'group', 'ids'
  const sourceId = searchParams.get("id");
  const sourceIdsStr = searchParams.get("ids");

  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState([]);
  const [contextTitle, setContextTitle] = useState("");

  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0].id);
  const [customMessage, setCustomMessage] = useState(TEMPLATES[0].text);

  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [batchResult, setBatchResult] = useState(null);
  const [forceBatch, setForceBatch] = useState(false);

  // WhatsApp Queue State
  const [useWhatsApp, setUseWhatsApp] = useState(false);
  const [whatsAppQueue, setWhatsAppQueue] = useState([]);

  // Confirmation State
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmStats, setConfirmStats] = useState(null);

  // 1. Resolve Context on Mount
  useEffect(() => {
    const base = API_BASE_URL || "http://localhost:8000";
    setLoading(true);

    async function loadContext() {
      try {
        if (source === "visit_list" && sourceId) {
          // Load Visit List recipients
          const listRes = await fetch(`${base}/visit-lists/${sourceId}`);
          const listInfo = await listRes.json();
          setContextTitle(`Visit List: ${listInfo.name}`);

          // Get members
          const membersRes = await fetch(`${base}/visit-lists/${sourceId}/members`);
          const members = await membersRes.json();

          // We need full office details for contacts
          const ids = members.map(m => m.office_id);
          if (ids.length > 0) {
            const officesRes = await fetch(`${base}/offices?ids=${ids.join(",")}`);
            const officeData = await officesRes.json();
            setOffices(officeData.data || []);
          } else {
            setOffices([]);
          }
        }
        else if (source === "ids" && sourceIdsStr) {
          setContextTitle("Selected Offices");
          const ids = sourceIdsStr.split(",");
          const officesRes = await fetch(`${base}/offices?ids=${ids.join(",")}`);
          const officeData = await officesRes.json();
          setOffices(officeData.data || []);
        }
        else if (source === "group" && sourceId) {
          setContextTitle(`Group #${sourceId}`);
          // Implies fetching group members - simplified for now
          const groupsRes = await fetch(`${base}/groups/${sourceId}`);
          const group = await groupsRes.json();
          // Assuming group has member count logic or separate endpoint, 
          // for now we might need a specific endpoint like `groups/{id}/members`.
          // But let's assume 'ids' is the primary way for now from Groups page.
          setContextTitle(`Group: ${group.name}`);
          // Note: If grouping logic is server side, we need an endpoint.
          // For strict compliance, the Group page should pass IDs or we need a new endpoint.
          // We'll stick to 'ids' passed from Group page for safety.
        }
        else {
          // No Valid Context
          setContextTitle(null);
        }
      } catch (err) {
        console.error("Failed to load context", err);
      } finally {
        setLoading(false);
      }
    }

    loadContext();
  }, [source, sourceId, sourceIdsStr]);


  const handleTemplateChange = (e) => {
    const tpl = TEMPLATES.find(t => t.id === e.target.value);
    setSelectedTemplate(tpl.id);
    setCustomMessage(tpl.text);
  };

  const getWhatsAppLink = (office) => {
    if (!office.phone) return "#";
    const phone = office.phone.replace(/[^0-9]/g, "");
    const text = customMessage.replace("[Name]", office.name || "Partner").replace("[District]", office.district || "your area");
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  };

  const initiateSend = async () => {
    if (!customMessage.trim()) return alert("Please enter a message.");
    if (offices.length === 0) return alert("No recipients.");

    setIsSendingBatch(true);
    const base = API_BASE_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${base}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_ids: offices.map(o => o.id),
          body: customMessage,
          force: forceBatch,
          dry_run: true
        })
      });
      const data = await res.json();
      setConfirmStats(data);
      setShowConfirm(true);
    } catch (err) {
      alert("Failed to prepare batch: " + err.message);
    } finally {
      setIsSendingBatch(false);
    }
  };

  const confirmSend = async () => {
    setShowConfirm(false);
    setIsSendingBatch(true);
    setBatchResult(null);
    const base = API_BASE_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${base}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_ids: offices.map(o => o.id),
          body: customMessage,
          force: forceBatch,
          dry_run: false
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to send batch");
      setBatchResult(data);

      // Update local state to reflect sent
      const skippedSet = new Set(data.skipped_ids || []);
      setOffices(prev => prev.map(o => !skippedSet.has(o.id) ? { ...o, contact_status: "Contacted" } : o));

      if (useWhatsApp) {
        const queue = offices.filter(o => !skippedSet.has(o.id) && o.phone);
        if (queue.length > 0) {
          setWhatsAppQueue(queue);
        } else {
          alert("All messages were skipped by guardrails (already visited/contacted).");
        }
      }

    } catch (err) {
      alert(err.message);
    } finally {
      setIsSendingBatch(false);
    }
  };

  const markContacted = async (officeId) => {
    try {
      const base = API_BASE_URL || "http://localhost:8000";
      await fetch(`${base}/offices/${officeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_status: "Contacted" })
      });
      setOffices(prev => prev.map(o => o.id === officeId ? { ...o, contact_status: "Contacted" } : o));
    } catch (e) {
      alert("Failed to mark as contacted");
    }
  };

  if (loading) return <div className="p-20 text-center text-muted">Loading context...</div>;

  // BLOCKING EMPTY STATE
  if (!contextTitle) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-ink">Batch Sender</h1>
            <p className="text-muted">
              Broadcast messages to your Visit List.
            </p>
          </div>
          <Link href="/list" className="btn-secondary text-sm">
            Manage Recipients in List
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Link href="/visits" className="block p-6 rounded-xl border border-slate-200 bg-white hover:border-primary hover:shadow-md transition-all text-left group">
            <div className="font-semibold text-lg group-hover:text-primary">Visit Lists →</div>
            <p className="text-sm text-muted mt-1">Open your planned visit lists.</p>
          </Link>
          <Link href="/list" className="block p-6 rounded-xl border border-slate-200 bg-white hover:border-primary hover:shadow-md transition-all text-left group">
            <div className="font-semibold text-lg group-hover:text-primary">Market List →</div>
            <p className="text-sm text-muted mt-1">Select offices from the market to message.</p>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* CONTEXT HEADER */}
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg flex justify-between items-center">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Messging Context</div>
          <h1 className="text-xl font-bold">{contextTitle}</h1>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono">{offices.length}</div>
          <div className="text-xs text-slate-400">Recipients</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h3 className="font-semibold text-sm mb-4">Message Configuration</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">Template</label>
                <select
                  value={selectedTemplate}
                  onChange={handleTemplateChange}
                  className="w-full text-sm p-2 border border-border rounded-lg bg-slate-50"
                >
                  {TEMPLATES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted uppercase mb-1">Message Preview</label>
                <textarea
                  className="w-full text-sm p-3 border border-border rounded-lg min-h-[120px] shadow-inner"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                />
                <p className="text-[10px] text-muted mt-1">
                  Variables: [Name], [District].
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-3">
                <button
                  onClick={initiateSend}
                  disabled={isSendingBatch || offices.length === 0}
                  className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingBatch ? "Analyzing..." : `Preview Batch (${offices.length})`}
                </button>

                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useWhatsApp}
                    onChange={e => setUseWhatsApp(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Also open WhatsApp for each recipient
                </label>

                <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceBatch}
                    onChange={e => setForceBatch(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Force send (bypass recent contact check)
                </label>
              </div>
            </div>
          </div>
        </div>

        {whatsAppQueue.length > 0 && (
          <WhatsAppQueue
            queue={whatsAppQueue}
            onClose={() => setWhatsAppQueue([])}
            getLink={getWhatsAppLink}
          />
        )}

        {showConfirm && confirmStats && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <h3 className="text-lg font-bold">Confirm Outreach</h3>
              <div className="space-y-2">
                <div className="flex justify-between p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Recipients</span>
                  <span className="font-bold text-ink">{confirmStats.sent_count} / {offices.length}</span>
                </div>
                {confirmStats.skipped_count > 0 && (
                  <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-100">
                    <p className="font-semibold">{confirmStats.skipped_count} Excluded</p>
                    <p className="text-xs mt-1">Already visited, Onboarded, Rejected, or Recently Contacted.</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
                <button onClick={confirmSend} className="flex-1 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm">Confirm & Send</button>
              </div>
            </div>
          </div>
        )}

        {/* Recipients List */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 border-b border-border bg-slate-50 flex justify-between items-center text-xs font-semibold text-muted uppercase tracking-wider">
              <span>Recipient ({offices.length})</span>
              <span>Status & Action</span>
            </div>
            <ul className="divide-y divide-border">
              {offices.map((office) => (
                <li key={office.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-ink flex items-center gap-2">
                      {office.name}
                      {office.contact_status === "Contacted" && <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Contacted</span>}
                    </div>
                    <div className="text-sm text-muted">
                      {office.district} • {office.phone || "No Phone"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {office.phone ? (
                      <>
                        <a
                          href={getWhatsAppLink(office)}
                          target="_blank"
                          onClick={() => markContacted(office.id)}
                          className="btn-primary text-sm px-4 py-2 flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] border-[#25D366] text-white"
                        >
                          <span>Send WhatsApp</span>
                          <span>↗</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-muted italic p-2">Missing phone</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OutreachPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center">Loading...</div>}>
      <OutreachContent />
    </Suspense>
  )
}

function WhatsAppQueue({ queue, onClose, getLink }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const current = queue[currentIndex];
  const progress = ((currentIndex) / queue.length) * 100;

  const handleNext = () => {
    if (currentIndex < queue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <h3 className="font-semibold">WhatsApp Batch Queue</h3>
          <span className="text-xs bg-slate-800 px-2 py-1 rounded">
            {currentIndex + 1} of {queue.length}
          </span>
        </div>

        <div className="h-1 bg-slate-100 w-full">
          <div className="h-full bg-[#25D366] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-8 text-center space-y-6">
          <div>
            <div className="text-xs text-muted uppercase tracking-wider mb-2">Sending to recipient</div>
            <h2 className="text-2xl font-bold text-ink">{current.name}</h2>
            <p className="text-sm font-mono text-slate-500 mt-1 bg-slate-50 inline-block px-2 py-1 rounded">{current.phone}</p>
          </div>

          <div className="flex flex-col gap-3">
            <a
              href={getLink(current)}
              target="_blank"
              onClick={handleNext}
              className="btn-primary bg-[#25D366] hover:bg-[#20bd5a] border-none text-white py-4 text-lg shadow-lg hover:shadow-xl transform transition-transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <span>Open WhatsApp</span>
              <span>↗</span>
            </a>
            <button
              onClick={handleNext}
              className="text-sm text-slate-400 hover:text-slate-700 py-2"
            >
              Skip this recipient
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-3 text-center text-xs text-muted border-t border-border">
          <button onClick={onClose} className="hover:text-red-600 transition-colors">Stop Batch</button>
        </div>
      </div>
    </div>
  );
}
