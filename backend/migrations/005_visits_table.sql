CREATE TABLE IF NOT EXISTS visits (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES office_groups(id) ON DELETE CASCADE,
    status VARCHAR NOT NULL DEFAULT 'Planned',
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
