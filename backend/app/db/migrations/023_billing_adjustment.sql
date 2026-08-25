-- Permite kind='adjustment' en el historial de facturación: correcciones del
-- superadmin que fijan el vencimiento a una fecha exacta (quitar o dar días).
-- SQLite no puede alterar un CHECK: se reconstruye la tabla.

CREATE TABLE venue_billing_events_new (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id            INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL CHECK (kind IN ('payment','trial','legacy','adjustment')),
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

INSERT INTO venue_billing_events_new SELECT * FROM venue_billing_events;
DROP TABLE venue_billing_events;
ALTER TABLE venue_billing_events_new RENAME TO venue_billing_events;

CREATE INDEX idx_billing_events_venue
ON venue_billing_events(venue_id, created_at DESC);

CREATE UNIQUE INDEX idx_billing_events_provider_ref
ON venue_billing_events(source, provider_ref)
WHERE provider_ref IS NOT NULL;
