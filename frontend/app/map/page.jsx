"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import DebugPanel from "../../components/DebugPanel";
import { useUrlFilters } from "../../hooks/useUrlFilters";

const MapClient = dynamic(() => import("./MapClient"), { ssr: false });
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

export default function MapPage() {
  // URL State
  const { filters, setFilter, setFilters, resetFilters } = useUrlFilters();
  const currentCity = filters.city || null;
  const currentDistrict = filters.district || null;
  const currentInterestStatus = filters.status || filters.interest_status || null; // Support both
  const currentSort = filters.sort || "priority";

  // Data State
  const [offices, setOffices] = useState([]);
  const [filteredOffices, setFilteredOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState(null);
  const [hoveredOfficeId, setHoveredOfficeId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // UI State
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [districts, setDistricts] = useState([]);

  const [queryState, setQueryState] = useState({
    bounds: null,
  });

  useEffect(() => {
    const base = API_BASE_URL || "http://localhost:8000";
    fetch(`${base}/districts`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.data)) {
          setDistricts(data.data);
        }
      })
      .catch(err => console.error("Failed to load districts", err));
  }, []);

  const handleBoundsChange = useCallback((bounds) => {
    if (!bounds) return;
    setQueryState((prev) => ({
      ...prev,
      bounds: {
        minLat: bounds.getSouth(),
        maxLat: bounds.getNorth(),
        minLng: bounds.getWest(),
        maxLng: bounds.getEast()
      }
    }));
  }, []);

  const fetchOffices = useCallback((bounds, city, district) => {
    if (!bounds) return;
    const base = API_BASE_URL || "http://localhost:8000";
    const params = new URLSearchParams({
      minLat: bounds.minLat.toString(),
      maxLat: bounds.maxLat.toString(),
      minLng: bounds.minLng.toString(),
      maxLng: bounds.maxLng.toString()
    });

    if (city !== null) params.set("city", city);
    if (district !== null) params.set("district", district);
    if (currentInterestStatus) params.set("interest_status", currentInterestStatus);

    const url = `${base}/offices?${params.toString()}`;
    setLoading(true);
    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error("Failed to load offices");
        setOffices(Array.isArray(data.data) ? data.data : []);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || String(err));
        setOffices([]);
      })
      .finally(() => setLoading(false));
  }, [currentInterestStatus]);

  useEffect(() => {
    if (!queryState.bounds) return;
    const timer = setTimeout(() => {
      fetchOffices(queryState.bounds, currentCity, currentDistrict);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryState.bounds, currentCity, currentDistrict, fetchOffices]);

  useEffect(() => {
    // Client-side filtering wrapper if needed, mostly for fast UI updates on status change
    // without refetching map bounds immediately if we don't want to.
    // Yet we trigger fetch on filter change via useUrlFilters -> dependencies.
    // So 'offices' should be accurate from backend. 
    // Just setting filteredOffices = offices for now unless we add client-only filters.

    // Legacy support: filtering strictly on client if fetched data includes mixed statuses?
    // Backend filters by status now, so we can trust it.

    setFilteredOffices(offices);
    setVisibleCount(PAGE_SIZE);
  }, [offices]);


  const sortedOffices = useMemo(() => {
    const items = [...filteredOffices];
    if (currentSort === "rating") {
      return items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (currentSort === "distance") {
      return items.sort((a, b) => {
        const aVal = a.nearest_office_distance_m ?? Number.MAX_SAFE_INTEGER;
        const bVal = b.nearest_office_distance_m ?? Number.MAX_SAFE_INTEGER;
        return aVal - bVal;
      });
    }
    return items.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  }, [filteredOffices, currentSort]);

  const visibleOffices = useMemo(() => {
    return sortedOffices.slice(0, visibleCount);
  }, [sortedOffices, visibleCount]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const backUrl = `${pathname}?${searchParams.toString()}`;

  const listItems = useMemo(() => {
    return visibleOffices.map((office) => (
      <div
        key={office.id}
        className={`rounded-xl border p-4 transition-all cursor-pointer ${office.id === selectedOfficeId ? "border-primary bg-blue-50/50 shadow-sm" : "border-border hover:bg-slate-50"
          }`}
        onMouseEnter={() => setHoveredOfficeId(office.id)}
        onMouseLeave={() => setHoveredOfficeId(null)}
        onClick={() => setSelectedOfficeId(office.id)}
      >
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">{office.name || "Office"}</div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${office.interest_status === 'Interested' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
            }`}>
            {office.interest_status || "New"}
          </span>
        </div>
        <div className="mt-1 text-xs text-muted">
          {office.city || "-"} / {office.district || "-"}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
          <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
            ⭐ {office.rating ?? "-"}
          </span>
          <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded">
            📍 {office.nearest_office_distance_m ?? "-"}m
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
          <Link href={`/offices/${office.id}?back=${encodeURIComponent(backUrl)}`} className="text-xs font-medium text-primary hover:underline">
            View Profile
          </Link>
        </div>
      </div>
    ));
  }, [visibleOffices, selectedOfficeId, backUrl]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Global Map Explorer</h1>
        <div className="text-sm text-muted">
          Showing {visibleOffices.length} of {filteredOffices.length} in view
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr] h-[calc(100vh-140px)]">
        {/* Sidebar */}
        <div className="flex flex-col gap-4 overflow-hidden h-full">
          <div className="rounded-xl bg-white border border-border p-4 shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Filters</div>
              <button
                className="text-xs text-primary hover:underline"
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? "Collapse" : "Expand"}
              </button>
            </div>
            {filtersOpen && (
              <div className="grid gap-3 text-sm">
                <input
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm"
                  onChange={(e) => setFilter("city", e.target.value || null)}
                  value={currentCity || ""}
                  placeholder="Filter by City..."
                />
                <select
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
                  onChange={(e) => setFilter("district", e.target.value || null)}
                  value={currentDistrict || ""}
                >
                  <option value="">All Districts</option>
                  {districts.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-white"
                  onChange={(e) => setFilter("status", e.target.value || null)}
                  value={currentInterestStatus || ""}
                >
                  <option value="">All Statuses</option>
                  <option value="Interested">Interested</option>
                  <option value="NotInterested">Not Interested</option>
                </select>
                <button
                  className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium hover:bg-slate-200 text-slate-600 transition-colors"
                  type="button"
                  onClick={resetFilters}
                >
                  Reset Filters
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 rounded-xl bg-white border border-border p-4 shadow-sm overflow-hidden flex flex-col">
            <div className="flex-shrink-0 flex items-center justify-between mb-4">
              <div className="text-sm font-semibold">Results</div>
              <select
                className="rounded-lg border border-border px-2 py-1 text-xs bg-white"
                value={currentSort}
                onChange={(event) => setFilter("sort", event.target.value)}
              >
                <option value="priority">Priority</option>
                <option value="distance">Distance</option>
                <option value="rating">Rating</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {listItems}
              {visibleOffices.length === 0 && (
                <div className="text-center py-8 text-muted text-sm">
                  Move map to find offices.
                </div>
              )}
              {visibleCount < sortedOffices.length && (
                <button
                  className="w-full py-2 text-xs font-medium text-primary hover:underline"
                  type="button"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Load more...
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-slate-50 h-full relative">
          <MapClient
            offices={filteredOffices}
            onBoundsChange={handleBoundsChange}
            onMarkerClick={(office) => setSelectedOfficeId(office.id)}
            selectedOfficeId={selectedOfficeId}
            hoveredOfficeId={hoveredOfficeId}
            focusOffice={offices.find(o => o.id === selectedOfficeId)}
          />
          {loading && (
            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-xs font-medium shadow-sm border border-black/5 z-10 flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
              Updating...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
