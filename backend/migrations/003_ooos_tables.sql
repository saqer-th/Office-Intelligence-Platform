CREATE TABLE IF NOT EXISTS office_groups (
    id SERIAL PRIMARY KEY,
    group_name VARCHAR,
    city VARCHAR,
    district VARCHAR,
    grid_id VARCHAR,
    status VARCHAR NOT NULL DEFAULT 'New',
    interested_count INTEGER NOT NULL DEFAULT 0,
    total_offices INTEGER NOT NULL DEFAULT 0,
    priority_score NUMERIC(8, 2),
    last_action_date TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS office_group_members (
    group_id INTEGER REFERENCES office_groups(id) ON DELETE CASCADE,
    office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
    interest_status VARCHAR NOT NULL DEFAULT 'Unknown',
    last_contact_date TIMESTAMP,
    PRIMARY KEY (group_id, office_id)
);

CREATE TABLE IF NOT EXISTS office_playbooks (
    office_id INTEGER PRIMARY KEY REFERENCES offices(id) ON DELETE CASCADE,
    current_step VARCHAR NOT NULL,
    next_action VARCHAR NOT NULL,
    last_updated TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS group_playbooks (
    group_id INTEGER PRIMARY KEY REFERENCES office_groups(id) ON DELETE CASCADE,
    current_step VARCHAR NOT NULL,
    next_action VARCHAR NOT NULL,
    ready_for_visit INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS office_activities (
    id SERIAL PRIMARY KEY,
    office_id INTEGER REFERENCES offices(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES office_groups(id) ON DELETE SET NULL,
    activity_type VARCHAR NOT NULL,
    outcome VARCHAR,
    notes TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS group_activities (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES office_groups(id) ON DELETE CASCADE,
    activity_type VARCHAR NOT NULL,
    outcome VARCHAR,
    notes TEXT,
    created_at TIMESTAMP NOT NULL
);
