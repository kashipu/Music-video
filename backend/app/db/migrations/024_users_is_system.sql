ALTER TABLE users ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT 0;

UPDATE users SET is_system = 1 WHERE phone = 'admin';
