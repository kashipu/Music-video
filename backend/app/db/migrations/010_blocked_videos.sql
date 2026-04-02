-- Videos that failed during playback (copyright, blocked, not embeddable)
-- Used to filter search results and reject at submit time
CREATE TABLE IF NOT EXISTS blocked_videos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_id  TEXT NOT NULL,
    venue_id    INTEGER REFERENCES venues(id),
    error_code  INTEGER,
    title       TEXT,
    blocked_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global lookup by youtube_id (most searches are global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_youtube ON blocked_videos(youtube_id);
