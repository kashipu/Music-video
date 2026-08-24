ALTER TABLE super_admins ADD COLUMN role TEXT NOT NULL DEFAULT 'super_admin' CHECK (role IN ('super_admin','vendedor','editor'));
