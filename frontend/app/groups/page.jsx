"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import GroupCard from "../../components/GroupCard";
import OfficeList from "../../components/OfficeList";
import DebugPanel from "../../components/DebugPanel";
import BulkAddToListModal from "../../components/BulkAddToListModal"; // Ensure path is correct
import { API_BASE_URL } from "../../utils/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ city: "", district: "" });

  const [activeTab, setActiveTab] = useState("clusters");
  const [districtStats, setDistrictStats] = useState([]);

  // Options State
  const [cityOptions, setCityOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);

  // Fetch Options
  useEffect(() => {
    fetch(`${API_BASE_URL}/groups?limit=1000`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const cities = [...new Set(data.map(g => g.city).filter(Boolean))].sort();
          setCityOptions(cities);
          const districts = [...new Set(data.map(g => g.district).filter(Boolean))].sort();
          setDistrictOptions(districts);
        }
      })
      .catch(console.error);

    // Prefetch district stats
    fetch(`${API_BASE_URL}/districts`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setDistrictStats(data);
      })
      .catch(console.error);

  }, []);

  const fetchGroups = () => {
    const params = new URLSearchParams();
    if (filters.city) params.append("city", filters.city);
    if (filters.district) params.append("district", filters.district);

    setLoading(true);
    fetch(`${API_BASE_URL}/groups?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error("Failed to load groups");
        setGroups(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGroups();
    }, 500);
    return () => clearTimeout(timer);
  }, [filters]);

  const readyGroups = groups.filter((g) => g.status === "ReadyForVisit");
  const monitoringGroups = groups.filter((g) => g.status === "Monitoring");

  const filteredDistrictStats = districtStats.filter(d => {
    if (filters.city && d.city !== filters.city) return false;
    if (filters.district && d.district !== filters.district) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">District Groups</h1>
          <p className="text-sm text-muted"> Organize offices by optimized clusters or strict districts</p>
        </div>
        <div className="flex gap-2">
          <select
            className="px-3 py-2 text-sm border border-border rounded-lg bg-white w-40"
            value={filters.city}
            onChange={(e) => setFilters(prev => ({ ...prev, city: e.target.value }))}
          >
            <option value="">All Cities</option>
            {cityOptions.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 text-sm border border-border rounded-lg bg-white w-40"
            value={filters.district}
            onChange={(e) => setFilters(prev => ({ ...prev, district: e.target.value }))}
          >
            <option value="">All Districts</option>
            {districtOptions.map(dist => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border">
        <button
          onClick={() => setActiveTab("clusters")}
          className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === "clusters" ? "text-primary border-b-2 border-primary" : "text-muted hover:text-ink"}`}
        >
          Route Clusters (Optimized)
        </button>
        <button
          onClick={() => setActiveTab("districts")}
          className={`pb-3 px-1 text-sm font-medium transition-all ${activeTab === "districts" ? "text-primary border-b-2 border-primary" : "text-muted hover:text-ink"}`}
        >
          By District (Strict)
        </button>
      </div>

      <DebugPanel title="Groups Debug" error={error} lastResponse={groups && groups.length > 0 ? groups[0] : null} />

      {loading && activeTab === "clusters" && (
        <div className="py-12 text-center text-muted animate-pulse">
          Loading groups...
        </div>
      )}

      {/* Cluster View */}
      {activeTab === "clusters" && !loading && (
        <>
          <div className="flex gap-2 text-sm">
            <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 font-medium">
              {readyGroups.length} Ready
            </span>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
              {monitoringGroups.length} Monitoring
            </span>
          </div>

          {readyGroups.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-4 text-green-800 flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
                Ready for Visit
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {readyGroups.map(group => (
                  <GroupCard key={group.id} group={group} />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-lg font-semibold mb-4 text-slate-700">Monitoring</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {monitoringGroups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))}
              {monitoringGroups.length === 0 && readyGroups.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
                  <p className="text-muted">No groups found.</p>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* District View */}
      {activeTab === "districts" && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Grid of Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredDistrictStats.map((stat, idx) => {
              const isExpanded = filters.expandedDistrict === stat.district;
              return (
                <div
                  key={idx}
                  className={`group bg-white rounded-xl border transition-all cursor-pointer ${isExpanded ? "border-primary ring-1 ring-primary shadow-md" : "border-border shadow-sm hover:shadow-md hover:border-primary/50"}`}
                  onClick={() => {
                    const url = `/districts/${encodeURIComponent(stat.district)}`;
                    window.location.href = url; // Use window loc or router if available, but simplest here
                  }}
                >
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-ink group-hover:text-primary transition-colors">{stat.district || "Unknown District"}</h3>
                        <p className="text-sm text-muted">{stat.city}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${isExpanded ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}>
                        {stat.total_offices} Offices
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-muted">Thinking</div>
                        <div className="font-semibold text-green-600">{stat.interested} Interested</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted">Visited</div>
                        <div className="font-semibold text-purple-600">{stat.visited} Visited</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDistrictStats.length === 0 && (
            <div className="py-12 text-center text-muted">
              No districts found matching filters.
            </div>
          )}
        </div>
      )}

      {error && (
        <DebugPanel error={error} />
      )}
    </div>
  );
}

function DistrictOfficeList({ district, city }) {
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [showAddToList, setShowAddToList] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (city) params.append("city", city);
    if (district) params.append("district", district);

    fetch(`${API_BASE_URL}/offices?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
        setOffices(Array.isArray(data.data) ? data.data : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [district, city]);

  return (
    <div className="relative">
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar border rounded-lg bg-slate-50 p-2">
        <OfficeList
          offices={offices}
          loading={loading}
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            const next = new Set(selectedIds);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            setSelectedIds(next);
          }}
        />
      </div>

      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-border animate-in slide-in-from-bottom-2 duration-200">
          <span className="font-medium text-ink">{selectedIds.size} offices selected</span>
          <button
            onClick={() => setShowAddToList(true)}
            className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm"
          >
            Add to Visit List
          </button>
        </div>
      )}

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
  )
}
