"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusBadge from "../../components/StatusBadge";
import { API_BASE_URL } from "../../utils/api";

export default function MessagesPage() {
    const [activeTab, setActiveTab] = useState("Inbox"); // Inbox, Sent
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMessages(activeTab);
    }, [activeTab]);

    const fetchMessages = (tab) => {
        setLoading(true);
        // Map tabs to statuses/directions
        // Inbox = Inbound
        // Sent = Outbound
        const statusParam = tab === "Inbox" ? "Inbox" : "Sent";

        fetch(`${API_BASE_URL}/messages?status=${statusParam}`)
            .then(res => res.json())
            .then(data => {
                setMessages(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load messages", err);
                setLoading(false);
            });
    };

    return (
        <div className="max-w-5xl mx-auto pb-12">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-ink">Message Center</h1>
                    <p className="text-muted">Manage outreach and communication.</p>
                </div>
                <div className="flex gap-2">
                    {/* Placeholder for future Actions */}
                </div>
            </div>

            <div className="flex gap-8">
                {/* Sidebar */}
                <div className="w-48 flex-shrink-0 space-y-2">
                    {["Inbox", "Sent"].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab
                                ? "bg-primary/10 text-primary"
                                : "text-slate-600 hover:bg-slate-50"
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-xl border border-border shadow-sm min-h-[600px] flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-muted">Loading messages...</div>
                    ) : messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted">
                            <div className="text-4xl mb-2">📭</div>
                            <p>No messages in {activeTab}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {messages.map(msg => (
                                <div key={msg.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-semibold text-sm text-ink">
                                            Office ID: {msg.office_id} {/* Pending: Expand Office Details */}
                                        </div>
                                        <div className="text-xs text-muted">
                                            {new Date(msg.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-800 line-clamp-2">
                                        {msg.body}
                                    </div>
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${msg.status === 'Sent' ? 'bg-slate-100 text-slate-600' :
                                            msg.status === 'Replied' ? 'bg-blue-50 text-blue-600' :
                                                'bg-red-50 text-red-600'
                                            }`}>
                                            {msg.status}
                                        </span>
                                        <Link href={`/offices/${msg.office_id}?back=/messages`} className="text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                            View Context →
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
