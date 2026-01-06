import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy.dialects.postgresql import insert

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import Office, OfficeGeoMetrics, OfficeGrid, OfficeScore

# ~0.005 degrees is roughly 500-600m around Riyadh; keep in sync with frontend.
GRID_SIZE_LAT = 0.005
GRID_SIZE_LNG = 0.005


def grid_id_for(lat, lng):
    lat_index = math.floor(lat / GRID_SIZE_LAT)
    lng_index = math.floor(lng / GRID_SIZE_LNG)
    return f"{lat_index}_{lng_index}", lat_index, lng_index


def normalize_scores(values):
    if not values:
        return {}
    min_val = min(values.values())
    max_val = max(values.values())
    if max_val == min_val:
        return {key: 0.0 for key in values}
    return {
        key: ((val - min_val) / (max_val - min_val)) * 100.0
        for key, val in values.items()
    }


def main():
    load_dotenv()
    session = SessionLocal()
    try:
        rows = (
            session.query(
                Office.id,
                Office.city,
                Office.rating,
                Office.rating_count,
                Office.latitude,
                Office.longitude,
                OfficeGeoMetrics.nearby_500m,
            )
            .outerjoin(
                OfficeGeoMetrics,
                OfficeGeoMetrics.office_id == Office.id
            )
            .all()
        )

        grid_stats = defaultdict(lambda: {
            "count": 0,
            "rating_sum": 0.0,
            "rating_count": 0,
            "city": None,
        })
        office_grid = {}

        for office_id, city, rating, rating_count, lat, lng, nearby_500m in rows:
            if lat is None or lng is None:
                continue
            grid_id, lat_index, lng_index = grid_id_for(lat, lng)
            office_grid[office_id] = (grid_id, city, lat_index, lng_index)
            grid_stats[grid_id]["count"] += 1
            if grid_stats[grid_id]["city"] is None and city:
                grid_stats[grid_id]["city"] = city
            if rating is not None:
                grid_stats[grid_id]["rating_sum"] += float(rating)
                grid_stats[grid_id]["rating_count"] += 1

        now = datetime.utcnow()
        grids_payload = []
        for grid_id, stats in grid_stats.items():
            lat_index = int(grid_id.split("_")[0])
            lng_index = int(grid_id.split("_")[1])
            center_lat = (lat_index + 0.5) * GRID_SIZE_LAT
            center_lng = (lng_index + 0.5) * GRID_SIZE_LNG
            avg_rating = (
                stats["rating_sum"] / stats["rating_count"]
                if stats["rating_count"] > 0
                else None
            )
            grids_payload.append({
                "grid_id": grid_id,
                "city": stats["city"],
                "center_lat": center_lat,
                "center_lng": center_lng,
                "office_count": stats["count"],
                "avg_rating": avg_rating,
                "updated_at": now,
            })

        density_raw = {}
        priority_raw = {}
        for office_id, city, rating, rating_count, lat, lng, nearby_500m in rows:
            grid_info = office_grid.get(office_id)
            if not grid_info:
                continue
            grid_id = grid_info[0]
            office_count = grid_stats[grid_id]["count"]
            nearby_500m = nearby_500m or 0
            density_raw[office_id] = office_count + nearby_500m

            rating_val = float(rating) if rating is not None else 0.0
            rating_count_val = int(rating_count or 0)
            priority_raw[office_id] = (
                (rating_val * 0.35)
                + (math.log(rating_count_val + 1) * 0.20)
                + (density_raw[office_id] * 0.30)
                + (nearby_500m * 0.15)
            )

        density_norm = normalize_scores(density_raw)
        priority_norm = normalize_scores(priority_raw)

        scores_payload = []
        for office_id in density_norm.keys():
            scores_payload.append({
                "office_id": office_id,
                "market_density_score": density_norm[office_id],
                "priority_score": priority_norm.get(office_id, 0.0),
                "updated_at": now,
            })

        session.query(OfficeGrid).delete()
        session.query(OfficeScore).delete()

        if grids_payload:
            grid_insert = insert(OfficeGrid).values(grids_payload)
            grid_insert = grid_insert.on_conflict_do_update(
                index_elements=[OfficeGrid.grid_id],
                set_={
                    "city": grid_insert.excluded.city,
                    "center_lat": grid_insert.excluded.center_lat,
                    "center_lng": grid_insert.excluded.center_lng,
                    "office_count": grid_insert.excluded.office_count,
                    "avg_rating": grid_insert.excluded.avg_rating,
                    "updated_at": grid_insert.excluded.updated_at,
                },
            )
            session.execute(grid_insert)

        if scores_payload:
            score_insert = insert(OfficeScore).values(scores_payload)
            score_insert = score_insert.on_conflict_do_update(
                index_elements=[OfficeScore.office_id],
                set_={
                    "market_density_score": score_insert.excluded.market_density_score,
                    "priority_score": score_insert.excluded.priority_score,
                    "updated_at": score_insert.excluded.updated_at,
                },
            )
            session.execute(score_insert)

        session.commit()
        print(f"Upserted {len(grids_payload)} grids and {len(scores_payload)} scores.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
