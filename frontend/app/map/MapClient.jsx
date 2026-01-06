"use client";

import { useEffect, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";

const DEFAULT_CENTER = [46.6753, 24.7136];
const DEFAULT_ZOOM = 5;

function normalizeCoord(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  return num;
}

function deriveStatus(office) {
  if (office.interest_status === "Interested") return "Interested";
  if (office.contact_status === "Interested") return "Interested";
  if (office.priority_score !== null && office.priority_score !== undefined && office.priority_score >= 75) {
    return "ReadyForVisit";
  }
  return "Monitoring";
}

function markerColor(status) {
  if (status === "Interested") return "#2563eb"; // blue-600
  if (status === "ReadyForVisit") return "#16a34a"; // green-600
  if (status === "Contacted") return "#ea580c"; // orange-600
  return "#94a3b8"; // slate-400
}


function getDistance(lat1, lon1, lat2, lon2) {
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
}

export default function MapClient({
  offices,
  onBoundsChange,
  onMarkerClick,
  selectedOfficeId,
  hoveredOfficeId,
  focusOffice
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const mapboxRef = useRef(null);
  const markersRef = useRef(new Map());
  const userMarkerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;
    if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
      return;
    }

    let cancelled = false;

    import("mapbox-gl").then((mapboxgl) => {
      if (cancelled) return;
      const mapbox = mapboxgl.default || mapboxgl;
      mapboxRef.current = mapbox;
      mapbox.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const mapInstance = new mapbox.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM
      });
      mapRef.current = mapInstance;

      mapInstance.on("load", () => {
        mapInstance.resize();
        console.log("Map initialized");
        if (onBoundsChange) {
          onBoundsChange(mapInstance.getBounds());
        }
      });

      mapInstance.on("moveend", () => {
        if (onBoundsChange) {
          onBoundsChange(mapInstance.getBounds());
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [onBoundsChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusOffice) return;
    const lat = normalizeCoord(focusOffice.latitude);
    const lng = normalizeCoord(focusOffice.longitude);
    if (lat === null || lng === null) return;
    map.flyTo({ center: [lng, lat], zoom: 14 });
  }, [focusOffice]);

  useEffect(() => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;
    if (!map || !mapbox) return;

    const validOffices = offices.filter((office) => {
      const lat = normalizeCoord(office.latitude);
      const lng = normalizeCoord(office.longitude);
      if (lat === null || lng === null) return false;
      if (lat === 0 && lng === 0) return false;
      return true;
    });

    const nextIds = new Set();
    validOffices.forEach((office) => {
      const lat = normalizeCoord(office.latitude);
      const lng = normalizeCoord(office.longitude);
      if (lat === null || lng === null) return;
      nextIds.add(office.id);

      const status = deriveStatus(office);
      const color = markerColor(status);

      if (markersRef.current.has(office.id)) {
        const existing = markersRef.current.get(office.id);
        const element = existing.getElement();
        element.classList.toggle("marker--selected", office.id === selectedOfficeId);
        element.classList.toggle("marker--hovered", office.id === hoveredOfficeId);
        element.style.backgroundColor = color;
        element.style.borderColor = color;
        return;
      }

      const popupHtml = `
        <div class="popup">
          <div class="popup-title">${office.name || "Office"}</div>
          <div class="popup-meta">Status: ${status}</div>
          <div class="popup-meta">City: ${office.city || "-"}</div>
          <div class="popup-actions">
            <a href="/offices/${office.id}" class="popup-link">Open profile</a>
          </div>
        </div>`;

      const popup = new mapbox.Popup({ offset: 18 }).setHTML(popupHtml);
      const marker = new mapbox.Marker({ color })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map);

      const element = marker.getElement();
      element.classList.add("marker");
      element.classList.toggle("marker--selected", office.id === selectedOfficeId);
      element.classList.toggle("marker--hovered", office.id === hoveredOfficeId);

      marker.getElement().addEventListener("click", () => {
        if (onMarkerClick) {
          onMarkerClick(office);
        }
      });

      markersRef.current.set(office.id, marker);
    });

    markersRef.current.forEach((marker, id) => {
      if (!nextIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });
  }, [offices, onMarkerClick, selectedOfficeId, hoveredOfficeId]);

  const handleLocateMe = () => {
    const map = mapRef.current;
    const mapbox = mapboxRef.current;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        // 1. Move map to user
        map.flyTo({ center: [longitude, latitude], zoom: 14 });

        // 2. Add user marker
        if (userMarkerRef.current) userMarkerRef.current.remove();

        const el = document.createElement("div");
        el.className = "user-location-marker";
        el.style.backgroundColor = "#3b82f6";
        el.style.width = "16px";
        el.style.height = "16px";
        el.style.borderRadius = "50%";
        el.style.border = "3px solid white";
        el.style.boxShadow = "0 0 10px rgba(0,0,0,0.2)";

        userMarkerRef.current = new mapbox.Marker(el)
          .setLngLat([longitude, latitude])
          .setPopup(new mapbox.Popup({ offset: 10 }).setHTML("<div>You are here</div>"))
          .addTo(map);

        // 3. Find nearest office
        let nearest = null;
        let minDist = Infinity;

        offices.forEach(o => {
          const oLat = normalizeCoord(o.latitude);
          const oLng = normalizeCoord(o.longitude);
          if (oLat && oLng) {
            const d = getDistance(latitude, longitude, oLat, oLng);
            if (d < minDist) {
              minDist = d;
              nearest = o;
            }
          }
        });

        if (nearest) {
          const distKm = (minDist / 1000).toFixed(2);
          // Highlight nearest
          if (onMarkerClick) onMarkerClick(nearest); // Select it

          // Optional: Show a popup or notification about nearest office
          console.log(`Nearest office is ${nearest.name} (${distKm}km away)`);
          // could add a line or specific popup

          new mapbox.Popup({ offset: 10 })
            .setLngLat([longitude, latitude])
            .setHTML(`<div class="p-2 text-sm">Nearest: <b>${nearest.name}</b><br/>${distKm} km away</div>`)
            .addTo(map);
        }
      },
      (error) => {
        console.error("Error getting location", error);
        alert("Unable to retrieve your location");
      }
    );
  };

  return (
    <div className="relative h-full min-h-[24rem] w-full rounded-xl border border-black/10 group">
      <div ref={mapContainerRef} className="h-full w-full rounded-xl" />

      <button
        onClick={handleLocateMe}
        className="absolute bottom-6 right-6 bg-white p-3 rounded-full shadow-lg hover:bg-slate-50 transition-all z-10 border border-slate-200 text-slate-700"
        title="Find Nearest Office"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>

      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Map token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN.
        </div>
      )}
    </div>
  );
}
