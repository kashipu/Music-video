CREATE TABLE venue_billing_events (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id            INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL CHECK (kind IN ('payment','trial','legacy')),
    source              TEXT NOT NULL DEFAULT 'manual',
    created_by_id       INTEGER,
    created_by_username TEXT,
    amount_cents        INTEGER,
    days                INTEGER,
    period_start        TEXT NOT NULL,
    period_end          TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'approved',
    provider_ref        TEXT,
    raw_payload         TEXT,
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK ((source = 'manual') = (created_by_id IS NOT NULL))
);

CREATE INDEX idx_billing_events_venue
ON venue_billing_events(venue_id, created_at DESC);

CREATE UNIQUE INDEX idx_billing_events_provider_ref
ON venue_billing_events(source, provider_ref)
WHERE provider_ref IS NOT NULL;

ALTER TABLE platform_settings
ADD COLUMN monthly_price_cents INTEGER NOT NULL DEFAULT 0;

INSERT INTO venue_billing_events (
    venue_id, kind, source, period_start, period_end, notes, created_at
)
SELECT id, 'legacy', 'legacy', date(created_at), paid_until, payment_notes, created_at
FROM venues
WHERE paid_until IS NOT NULL;
