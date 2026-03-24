CREATE TABLE IF NOT EXISTS super_admins (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add active flag to venues
ALTER TABLE venues ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
