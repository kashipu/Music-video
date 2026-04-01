CREATE TABLE IF NOT EXISTS venue_daily_pins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER NOT NULL REFERENCES venues(id),
    pin         TEXT NOT NULL,
    valid_date  TEXT NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_venue_pin_date ON venue_daily_pins(venue_id, valid_date);
