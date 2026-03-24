CREATE TABLE IF NOT EXISTS fallback_songs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    youtube_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    thumbnail_url   TEXT,
    duration_sec    INTEGER DEFAULT 0,
    position        INTEGER NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fallback_venue ON fallback_songs(venue_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fallback_unique ON fallback_songs(venue_id, youtube_id);
