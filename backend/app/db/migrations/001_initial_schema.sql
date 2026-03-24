CREATE TABLE IF NOT EXISTS venues (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    fallback_playlist TEXT,
    fallback_mode   TEXT NOT NULL DEFAULT 'playlist'
                    CHECK (fallback_mode IN ('playlist', 'youtube_recommendations')),
    config          TEXT DEFAULT '{}',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    phone           TEXT UNIQUE NOT NULL,
    display_name    TEXT,
    data_consent    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS user_sessions (
    id              TEXT PRIMARY KEY,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    table_number    TEXT NOT NULL,
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at        TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_venue ON user_sessions(user_id, venue_id);
CREATE INDEX IF NOT EXISTS idx_sessions_venue_active ON user_sessions(venue_id, ended_at);

CREATE TABLE IF NOT EXISTS queue_songs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    session_id      TEXT NOT NULL REFERENCES user_sessions(id),
    youtube_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    thumbnail_url   TEXT,
    duration_sec    INTEGER,
    position        INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'playing', 'played', 'removed')),
    added_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    played_at       TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_queue_venue_status ON queue_songs(venue_id, status, position);
CREATE UNIQUE INDEX IF NOT EXISTS idx_queue_active_video ON queue_songs(venue_id, youtube_id)
    WHERE status IN ('pending', 'playing');
CREATE INDEX IF NOT EXISTS idx_queue_user ON queue_songs(user_id, venue_id);

CREATE TABLE IF NOT EXISTS submission_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL REFERENCES users(id),
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_rate_limit ON submission_log(user_id, venue_id, submitted_at);

CREATE TABLE IF NOT EXISTS admins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS play_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id        INTEGER NOT NULL REFERENCES venues(id),
    user_id         INTEGER NOT NULL REFERENCES users(id),
    youtube_id      TEXT NOT NULL,
    title           TEXT NOT NULL,
    artist          TEXT,
    genre           TEXT,
    played_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_sec    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_history_venue_date ON play_history(venue_id, played_at);
CREATE INDEX IF NOT EXISTS idx_history_youtube ON play_history(youtube_id);
CREATE INDEX IF NOT EXISTS idx_history_user ON play_history(user_id, played_at);

CREATE TABLE IF NOT EXISTS song_metadata (
    youtube_id      TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    artist          TEXT,
    genre           TEXT,
    tags            TEXT,
    duration_sec    INTEGER,
    first_seen_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
