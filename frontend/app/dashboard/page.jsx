"use client";

import { useEffect, useState } from "react";
import DebugPanel from "../../components/DebugPanel";
import { API_BASE_URL } from "../../utils/api";

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastResponse, setLastResponse] = useState(null);

  useEffect(() => {
    const url = `${API_BASE_URL}/stats`;
    console.log("Dashboard fetch:", url);
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        console.log("Dashboard status:", res.status);
        const data = await res.json();
        console.log("Dashboard data:", data);
        setLastResponse(data);
        if (!res.ok) {
          throw new Error("Failed to load stats");
        }
        setStats(data);
        setError(null);
      })
      .catch((err) => {
        console.error("Dashboard error:", err);
        setError(err.message || String(err));
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Visits Today", value: stats?.visited_today ?? "--" },
    { label: "Visits This Week", value: stats?.visited_week ?? "--" },
    { label: "Total Visited", value: stats?.total_visited ?? "--" },
    { label: "Groups Ready", value: stats?.ready_for_visit_groups ?? "--" },
    { label: "Total Offices", value: stats?.total_offices ?? "--" },
    { label: "Interested", value: stats?.interested ?? "--" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="rounded-xl bg-panel p-4 text-sm text-muted">
        {loading ? "Loading stats..." : error ? "Failed to load stats." : "Stats loaded."}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-panel p-4 shadow-sm">
            <div className="text-xs text-muted">{card.label}</div>
            <div className="mt-2 text-2xl font-semibold">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-panel p-6 shadow-sm">
        <div className="text-sm font-semibold">Conversion Funnel</div>
        <div className="mt-3 h-40 rounded-lg border border-dashed border-black/10"></div>
      </div>
      <DebugPanel
        title="Dashboard Debug"
        apiBaseUrl={API_BASE_URL}
        lastResponse={lastResponse}
        error={error}
      />
    </div>
  );
}
