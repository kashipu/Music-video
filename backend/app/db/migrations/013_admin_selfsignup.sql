ALTER TABLE admins ADD COLUMN email TEXT;
ALTER TABLE admins ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admins ADD COLUMN google_sub TEXT;
ALTER TABLE admins ADD COLUMN terms_accepted_at TIMESTAMP;
ALTER TABLE admins ADD COLUMN terms_version TEXT;
ALTER TABLE admins ADD COLUMN privacy_accepted_at TIMESTAMP;

CREATE UNIQUE INDEX idx_admins_email ON admins(email);
CREATE UNIQUE INDEX idx_admins_google_sub ON admins(google_sub);

CREATE TABLE email_tokens (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id    INTEGER REFERENCES admins(id),
    token_hash  TEXT NOT NULL,
    purpose     TEXT NOT NULL CHECK (purpose IN ('verify', 'reset')),
    expires_at  TIMESTAMP NOT NULL,
    used_at     TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE platform_settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    trial_days          INTEGER NOT NULL DEFAULT 15,
    grace_period_days   INTEGER NOT NULL DEFAULT 5
);

INSERT INTO platform_settings (id) VALUES (1);
