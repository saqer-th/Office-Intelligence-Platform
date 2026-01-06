CREATE TABLE IF NOT EXISTS office_grids (
    grid_id VARCHAR PRIMARY KEY,
    city VARCHAR,
    center_lat DOUBLE PRECISION NOT NULL,
    center_lng DOUBLE PRECISION NOT NULL,
    office_count INTEGER NOT NULL,
    avg_rating DOUBLE PRECISION,
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS office_scores (
    office_id INTEGER PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
    market_density_score NUMERIC(8, 2),
    priority_score NUMERIC(8, 2),
    updated_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS office_outreach (
    office_id INTEGER PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
    contact_status VARCHAR NOT NULL DEFAULT 'New',
    assigned_to VARCHAR,
    last_contact_date TIMESTAMP,
    notes TEXT
);
