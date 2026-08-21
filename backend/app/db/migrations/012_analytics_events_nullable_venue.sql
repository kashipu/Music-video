-- P0.1: /api/queue/search is public (no venue context yet) and was logging
-- song_searched events with venue_id=0. analytics_events.venue_id was
-- NOT NULL REFERENCES venues(id), so with PRAGMA foreign_keys=ON that INSERT
-- always failed silently (caught by a bare except), leaving top_searches,
-- search_stats and part of the analytics funnel at zero forever.
-- Make venue_id nullable so anonymous search events can be recorded as
-- venue-less instead of being dropped.

ALTER TABLE analytics_events RENAME TO analytics_events_old;

CREATE TABLE analytics_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER REFERENCES venues(id),
    event_type  TEXT NOT NULL,
    event_data  TEXT DEFAULT '{}',
    user_id     INTEGER REFERENCES users(id),
    session_id  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO analytics_events (id, venue_id, event_type, event_data, user_id, session_id, created_at)
SELECT id, venue_id, event_type, event_data, user_id, session_id, created_at FROM analytics_events_old;

DROP TABLE analytics_events_old;

CREATE INDEX IF NOT EXISTS idx_analytics_venue_type ON analytics_events(venue_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_venue_date ON analytics_events(venue_id, created_at);
