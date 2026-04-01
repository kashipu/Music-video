CREATE TABLE IF NOT EXISTS analytics_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER NOT NULL REFERENCES venues(id),
    event_type  TEXT NOT NULL,
    event_data  TEXT DEFAULT '{}',
    user_id     INTEGER REFERENCES users(id),
    session_id  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_venue_type ON analytics_events(venue_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_venue_date ON analytics_events(venue_id, created_at);
