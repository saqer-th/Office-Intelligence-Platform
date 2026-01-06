CREATE TABLE IF NOT EXISTS office_geo_metrics (
    office_id INTEGER PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
    nearest_office_distance_m INTEGER,
    nearby_300m INTEGER NOT NULL DEFAULT 0,
    nearby_500m INTEGER NOT NULL DEFAULT 0,
    nearby_1km INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL
);
