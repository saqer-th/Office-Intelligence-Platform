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

    console.log("Offices passed to map:", offices.length);

    const validOffices = offices.filter((office) => {
      const lat = normalizeCoord(office.latitude);
      const lng = normalizeCoord(office.longitude);
      if (lat === null || lng === null) return false;
      if (lat === 0 && lng === 0) return false;
      return true;
    });

    console.log("Valid coordinates:", validOffices.length);

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

  return (
    <div className="relative h-full min-h-[24rem] w-full rounded-xl border border-black/10">
      <div ref={mapContainerRef} className="h-full w-full rounded-xl" />
      {!process.env.NEXT_PUBLIC_MAPBOX_TOKEN && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">
          Map token missing. Set NEXT_PUBLIC_MAPBOX_TOKEN.
        </div>
      )}
    </div>
  );
}
