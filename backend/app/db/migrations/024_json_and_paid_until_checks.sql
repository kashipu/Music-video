-- migrate: foreign_keys=off
-- SQLite no puede agregar CHECK a columnas existentes: se reconstruyen las
-- tablas. Las FK se desactivan solo durante esta migración porque venues es
-- tabla padre; DROP TABLE con FK activas borraría hijos ON DELETE CASCADE.

-- Conserva JSON heredado inválido dentro de un objeto válido para no perder
-- el valor original. Los consumidores actuales esperan objetos JSON.
UPDATE venues
SET config = json_object('_invalid_legacy_value', config)
WHERE NOT json_valid(config);

UPDATE analytics_events
SET event_data = json_object('_invalid_legacy_value', event_data)
WHERE NOT json_valid(event_data);

-- Una fecha heredada inválida no puede seguir habilitando el venue: se
-- preserva literalmente en las notas, se suspende el venue y se limpia.
UPDATE venues
SET payment_notes = COALESCE(payment_notes || char(10), '') ||
                    '[WIL-130] paid_until inválido preservado: ' || quote(paid_until),
    active = FALSE,
    paid_until = NULL
WHERE paid_until IS NOT NULL AND NOT (
    length(paid_until) = 10 AND
    paid_until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
    substr(paid_until, 1, 4) BETWEEN '0001' AND '9999' AND
    date(paid_until) IS NOT NULL AND date(paid_until) = paid_until AND
    date(julianday(paid_until)) IS NOT NULL AND date(julianday(paid_until)) = paid_until
);

CREATE TABLE venues_new (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    slug              TEXT UNIQUE NOT NULL,
    fallback_playlist TEXT,
    fallback_mode     TEXT NOT NULL DEFAULT 'playlist'
                      CHECK (fallback_mode IN ('playlist', 'youtube_recommendations')),
    config            TEXT DEFAULT '{}' CHECK (json_valid(config)),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    logo_url          TEXT DEFAULT NULL,
    qr_url            TEXT DEFAULT NULL,
    paid_until        TEXT DEFAULT NULL CHECK (
                          paid_until IS NULL OR
                          (length(paid_until) = 10 AND
                           paid_until GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND
                           substr(paid_until, 1, 4) BETWEEN '0001' AND '9999' AND
                           date(paid_until) IS NOT NULL AND date(paid_until) = paid_until AND
                           date(julianday(paid_until)) IS NOT NULL AND
                           date(julianday(paid_until)) = paid_until)
                      ),
    payment_notes     TEXT DEFAULT NULL,
    address           TEXT,
    address_lat       REAL,
    address_lng       REAL,
    venue_type        TEXT CHECK (venue_type IN ('discoteca', 'rock', 'musica_popular', 'otro')),
    venue_type_other  TEXT,
    logo_url_light    TEXT DEFAULT NULL,
    logo_url_dark     TEXT DEFAULT NULL
);

INSERT INTO venues_new (
    id, name, slug, fallback_playlist, fallback_mode, config, created_at,
    active, logo_url, qr_url, paid_until, payment_notes, address,
    address_lat, address_lng, venue_type, venue_type_other,
    logo_url_light, logo_url_dark
)
SELECT
    id, name, slug, fallback_playlist, fallback_mode, config, created_at,
    active, logo_url, qr_url, paid_until, payment_notes, address,
    address_lat, address_lng, venue_type, venue_type_other,
    logo_url_light, logo_url_dark
FROM venues;

DROP TABLE venues;
ALTER TABLE venues_new RENAME TO venues;

CREATE TABLE analytics_events_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    venue_id    INTEGER REFERENCES venues(id),
    event_type  TEXT NOT NULL,
    event_data  TEXT DEFAULT '{}' CHECK (json_valid(event_data)),
    user_id     INTEGER REFERENCES users(id),
    session_id  TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO analytics_events_new (
    id, venue_id, event_type, event_data, user_id, session_id, created_at
)
SELECT
    id, venue_id, event_type, event_data, user_id, session_id, created_at
FROM analytics_events;

DROP TABLE analytics_events;
ALTER TABLE analytics_events_new RENAME TO analytics_events;

CREATE INDEX idx_analytics_venue_type
ON analytics_events(venue_id, event_type, created_at);

CREATE INDEX idx_analytics_venue_date
ON analytics_events(venue_id, created_at);

CREATE INDEX idx_analytics_event_type
ON analytics_events(event_type, created_at);
