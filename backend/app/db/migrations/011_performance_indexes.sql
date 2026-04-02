-- Index for JOIN on queue_songs.session_id (used in admin/tables, queue display)
CREATE INDEX IF NOT EXISTS idx_queue_session ON queue_songs(session_id);

-- Index for analytics_events queries without venue filter (global search stats)
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type, created_at);
