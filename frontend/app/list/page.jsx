"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OfficeList from "../../components/OfficeList";
import DebugPanel from "../../components/DebugPanel";
import ComposeMessageModal from "../../components/ComposeMessageModal";
import BulkAddToListModal from "../../components/BulkAddToListModal";
import { useUrlFilters } from "../../hooks/useUrlFilters";

const MapClient = dynamic(() => import("../map/MapClient"), { ssr: false });
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const DEBOUNCE_MS = 300;
const PAGE_SIZE = 50;

export default function ListPage() {
  const router = useRouter();
  // URL State
  const { filters, setFilter, setFilters } = useUrlFilters();
  const currentCity = filters.city || null;
  const currentDistrict = filters.district || null;
  const currentStatus = filters.status || "All";
  const currentSearch = filters.search || "";
  const currentSort = filters.sort || "priority";

  // Data State
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visitList, setVisitList] = useState([]);

  // UI State
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [mapOpen, setMapOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(currentSearch);
  const [showCompose, setShowCompose] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);

  // Options State
  const [cityOptions, setCityOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);

  // Sync Search Input with URL
  useEffect(() => {
    setSearchInput(currentSearch);
  }, [currentSearch]);

  // Debounce Search update to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        setFilter("search", searchInput);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, currentSearch, setFilter]);

  // Fetch Options (One-time fetch for filter lists)
  useEffect(() => {
    const base = API_BASE_URL || "http://localhost:8000";
    fetch(`${base}/offices?limit=1000`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.data)) {
          const cities = [...new Set(data.data.map(o => o.city).filter(Boolean))].sort();
          setCityOptions(cities);
        }
      })
      .catch(console.error);
  }, []);

  // Update District Options when City changes
  useEffect(() => {
    if (!currentCity) {
      setDistrictOptions([]);
      return;
    }
    const base = API_BASE_URL || "http://localhost:8000";
    fetch(`${base}/offices?limit=1000&city=${currentCity}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.data)) {
          const districts = [...new Set(data.data.map(o => o.district).filter(Boolean))].sort();
          setDistrictOptions(districts);
        }
      })
      .catch(console.error);

  }, [currentCity]);


  // Fetch Offices
  const fetchOffices = useCallback(() => {
    setLoading(true);
    const base = API_BASE_URL || "http://localhost:8000";
    const params = new URLSearchParams({ limit: PAGE_SIZE.toString() });

    if (currentCity) params.append("city", currentCity);
    if (currentDistrict) params.append("district", currentDistrict);
    if (currentStatus && currentStatus !== "All") params.append("interest_status", currentStatus);
    if (currentSearch) params.append("search", currentSearch);

    fetch(`${base}/offices?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error("Failed to load offices");
        setOffices(Array.isArray(data.data) ? data.data : []);
      })
      .catch((err) => {
        console.error(err);
        setOffices([]);
      })
      .finally(() => setLoading(false));
  }, [currentCity, currentDistrict, currentStatus, currentSearch]);

  useEffect(() => {
    fetchOffices();
  }, [fetchOffices]);

  // Handlers
  const toggleSelection = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const addToVisitList = () => {
    setShowAddToList(true);
  };

  const handleSendMessage = () => {
    const ids = Array.from(selectedIds).join(",");
    router.push(`/outreach?source=ids&ids=${ids}`);
  };

  // Geolocation for "Nearest" sorting
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (currentSort === "distance" && !userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => console.error("Locate error", err)
        );
      }
    }
  }, [currentSort, userLocation]);

  const getDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const sortedOffices = useMemo(() => {
    let items = [...offices];

    // Inject user distance if available
    if (userLocation) {
      items = items.map(o => {
        const dist = (o.latitude && o.longitude)
          ? getDist(userLocation.lat, userLocation.lng, Number(o.latitude), Number(o.longitude))
          : null;
        return { ...o, user_distance_m: dist };
      });
    }

    if (currentSort === "distance") {
      // Sort by user distance if available, otherwise by internal nearest metric
      return items.sort((a, b) => {
        if (a.user_distance_m !== null && b.user_distance_m !== null) {
          return a.user_distance_m - b.user_distance_m;
        }
        return (a.nearest_office_distance_m || 9999) - (b.nearest_office_distance_m || 9999);
      });
    }
    if (currentSort === "rating") {
      return items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    // Default: Priority
    return items.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  }, [offices, currentSort, userLocation]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header / Filter Bar */}
        <header className="flex flex-col flex-shrink-0 border-b border-border bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-4 py-3 lg:px-6 lg:py-4">
            <h1 className="text-xl font-bold text-ink">Market List</h1>
            <div className="flex items-center gap-2">
              <Link href="/messages" className="lg:hidden p-2 text-slate-600">
                <span className="text-xl">💬</span>
              </Link>
              <button
                onClick={() => setMapOpen(!mapOpen)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${mapOpen
                  ? "bg-slate-800 text-white shadow-md"
                  : "bg-white text-slate-700 border border-border hover:bg-slate-50"
                  }`}
              >
                {mapOpen ? "Hide Map" : "Show Map"}
              </button>
            </div>
          </div>

          {/* Scrollable Filters for Mobile */}
          <div className="flex items-center gap-2 overflow-x-auto px-4 pb-3 lg:px-6 lg:pb-4 custom-scrollbar">
            <div className="relative flex-shrink-0">
              <input
                type="text"
                placeholder="Search offices..."
                className="h-9 w-40 lg:w-48 rounded-lg border border-border bg-slate-50 pl-3 pr-8 text-sm focus:border-primary focus:outline-none"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>
            <select
              className="h-9 w-32 rounded-lg border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:outline-none flex-shrink-0"
              value={currentCity || ""}
              onChange={(e) => setFilters({ city: e.target.value || null, district: null })}
            >
              <option value="">All Cities</option>
              {cityOptions.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            <select
              className="h-9 w-32 rounded-lg border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:outline-none flex-shrink-0"
              value={currentDistrict || ""}
              onChange={(e) => setFilter("district", e.target.value || null)}
              disabled={!currentCity}
            >
              <option value="">All Districts</option>
              {districtOptions.map(dist => (
                <option key={dist} value={dist}>{dist}</option>
              ))}
            </select>
            <select
              className="h-9 rounded-lg border border-border bg-slate-50 px-3 text-sm focus:border-primary focus:outline-none flex-shrink-0"
              value={currentStatus}
              onChange={(e) => setFilter("status", e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="New">New</option>
              <option value="Interested">Interested</option>
              <option value="Contacted">Contacted</option>
              <option value="Visited">Visited</option>
            </select>

            <div className="hidden lg:flex items-center gap-3 ml-auto">
              <Link href="/messages" className="px-3 py-2 text-sm font-medium text-slate-700 hover:text-primary">
                Message Center
              </Link>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="flex flex-1 overflow-hidden">
          {/* List Column */}
          <div className={`flex flex-col border-r border-border bg-white transition-all duration-300 ${mapOpen ? "w-1/2" : "w-full"}`}>

            {/* Toolbar / Action Bar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-slate-50 min-h-[50px]">
              {selectedIds.size > 0 ? (
                <div className="flex items-center gap-3 w-full animate-in fade-in duration-200">
                  <span className="text-sm font-bold text-ink">{selectedIds.size} Selected</span>
                  <div className="h-4 w-px bg-slate-300"></div>
                  <button
                    onClick={addToVisitList}
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
                <>
                  <div className="text-xs text-muted font-medium">
                    {offices.length} Offices found
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">Sort:</span>
                    <select
                      className="text-xs bg-transparent border-none font-medium text-ink focus:ring-0 cursor-pointer"
                      value={currentSort}
                      onChange={(e) => setFilter("sort", e.target.value)}
                    >
                      <option value="priority">Priority</option>
                      <option value="distance">Distance</option>
                      <option value="rating">Rating</option>
                    </select>
                  </div>
                </>
              )}
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative">
              <OfficeList
                offices={sortedOffices}
                loading={loading}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelection}
              />

              {/* Floating Action Bar REPLACED by Top Toolbar */}
            </div>
          </div>

          {/* Map Column */}
          {mapOpen && (
            <div className="flex-1 bg-slate-100 relative">
              <MapClient
                offices={sortedOffices}
                onMarkerClick={(office) => {
                  // Optional: scroll to item in list
                  console.log("Clicked", office.name);
                }}
              />
              <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-xs shadow border border-black/5">
                Visualizing current list results
              </div>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <ComposeMessageModal
          selectedIds={selectedIds}
          onClose={() => setShowCompose(false)}
          onSuccess={() => {
            // Optional: Deselect all after send
            setSelectedIds(new Set());
          }}
        />
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
  );
}
