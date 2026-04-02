-- Add last_activity_at to track session inactivity for expiration
ALTER TABLE user_sessions ADD COLUMN last_activity_at TIMESTAMP;

-- Backfill existing sessions
UPDATE user_sessions SET last_activity_at = COALESCE(ended_at, started_at);

CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity_at)
    WHERE ended_at IS NULL;
