-- Analytics events table: tracks all measurable product events
CREATE TABLE IF NOT EXISTS analytics_events (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    user_id         INTEGER,
    session_id      TEXT,
    event_type      TEXT NOT NULL,
    event_data      TEXT DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_venue_type ON analytics_events(venue_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_events_venue_date ON analytics_events(venue_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id, created_at);

-- Add artist/genre to play_history if missing (backfill from song_metadata)
UPDATE play_history SET
    artist = (SELECT sm.artist FROM song_metadata sm WHERE sm.youtube_id = play_history.youtube_id),
    genre = (SELECT sm.genre FROM song_metadata sm WHERE sm.youtube_id = play_history.youtube_id)
WHERE artist IS NULL AND EXISTS (
    SELECT 1 FROM song_metadata sm WHERE sm.youtube_id = play_history.youtube_id AND sm.artist IS NOT NULL
);
