import math
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import Office, OfficeGeoMetrics

EARTH_RADIUS_M = 6371000.0
THRESHOLDS_M = (300, 500, 1000)


def haversine_m(lat1, lon1, lat2, lon2):
    """Return great-circle distance in meters using the haversine formula."""
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    sin_dlat = math.sin(dlat / 2)
    sin_dlon = math.sin(dlon / 2)
    a = sin_dlat * sin_dlat + math.cos(lat1) * math.cos(lat2) * sin_dlon * sin_dlon
    c = 2 * math.asin(min(1.0, math.sqrt(a)))
    return EARTH_RADIUS_M * c


def normalize_offices(rows):
    normalized = []
    for office_id, lat, lon in rows:
        # Keep placeholders for offices without coordinates so they still get metrics rows.
        if lat is None or lon is None:
            normalized.append((office_id, None, None))
            continue
        normalized.append((office_id, math.radians(lat), math.radians(lon)))
    return normalized


def compute_metrics(offices):
    metrics = []
    now = datetime.utcnow()
    valid = [(oid, lat, lon) for oid, lat, lon in offices if lat is not None and lon is not None]

    for office_id, lat, lon in offices:
        if lat is None or lon is None:
            # No coordinates means no distances can be computed.
            metrics.append({
                "office_id": office_id,
                "nearest_office_distance_m": None,
                "nearby_300m": 0,
                "nearby_500m": 0,
                "nearby_1km": 0,
                "updated_at": now,
            })
            continue

        nearest = None
        counts = {threshold: 0 for threshold in THRESHOLDS_M}
        for other_id, other_lat, other_lon in valid:
            if other_id == office_id:
                continue
            # Haversine distance uses radians for stable numeric results.
            distance = haversine_m(lat, lon, other_lat, other_lon)
            if nearest is None or distance < nearest:
                nearest = distance
            for threshold in THRESHOLDS_M:
                if distance <= threshold:
                    counts[threshold] += 1

        metrics.append({
            "office_id": office_id,
            "nearest_office_distance_m": int(round(nearest)) if nearest is not None else None,
            "nearby_300m": counts[300],
            "nearby_500m": counts[500],
            "nearby_1km": counts[1000],
            "updated_at": now,
        })

    return metrics


def main():
    load_dotenv()
    session = SessionLocal()
    try:
        rows = session.query(Office.id, Office.latitude, Office.longitude).all()
        offices = normalize_offices(rows)
        metrics = compute_metrics(offices)

        session.query(OfficeGeoMetrics).delete()
        session.bulk_insert_mappings(OfficeGeoMetrics, metrics)
        session.commit()
        print(f"Inserted {len(metrics)} geo metric rows.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
