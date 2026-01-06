import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.db import SessionLocal
from app.models import Office

EXPECTED_HEADERS = {
    "node_id",
    "name",
    "region",
    "city",
    "district",
    "phone",
    "rating",
    "rating_count",
    "latitude",
    "longitude",
    "google_maps_url",
    "profile_url",
}


def to_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def to_int(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize(value):
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        return cleaned if cleaned else None
    return value


def load_rows(path: Path):
    workbook = openpyxl.load_workbook(path, read_only=True)
    sheet = workbook.active
    rows = sheet.iter_rows(values_only=True)
    headers = [normalize(cell) for cell in next(rows)]
    header_index = {header: index for index, header in enumerate(headers) if header}

    missing = EXPECTED_HEADERS - set(header_index)
    if missing:
        raise ValueError(f"Missing columns in Excel: {', '.join(sorted(missing))}")

    for row in rows:
        def get_value(key):
            return row[header_index[key]]

        yield {
            "node_id": to_int(get_value("node_id")),
            "name": normalize(get_value("name")),
            "region": normalize(get_value("region")),
            "city": normalize(get_value("city")),
            "district": normalize(get_value("district")),
            "phone": normalize(get_value("phone")),
            "rating": to_float(get_value("rating")),
            "rating_count": to_int(get_value("rating_count")),
            "latitude": to_float(get_value("latitude")),
            "longitude": to_float(get_value("longitude")),
            "google_maps_url": normalize(get_value("google_maps_url")),
            "profile_url": normalize(get_value("profile_url")),
        }


def main():
    load_dotenv()
    if len(sys.argv) > 1 and sys.argv[1] not in {"--truncate"}:
        path = Path(sys.argv[1])
        truncate = "--truncate" in sys.argv[2:]
    else:
        path = Path("ejar_riyadh_offices_ALL_with_location.xlsx")
        truncate = "--truncate" in sys.argv[1:]

    if not path.exists():
        raise FileNotFoundError(f"Excel file not found: {path}")

    session = SessionLocal()
    try:
        if truncate:
            session.query(Office).delete()
            session.commit()

        now = datetime.utcnow()
        inserted = 0
        for row in load_rows(path):
            office = Office(**row, created_at=now, updated_at=now)
            session.add(office)
            inserted += 1

        session.commit()
        print(f"Inserted {inserted} rows into offices.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
