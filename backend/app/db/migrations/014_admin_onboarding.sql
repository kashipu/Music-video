ALTER TABLE admins ADD COLUMN full_name TEXT;
ALTER TABLE admins ADD COLUMN phone TEXT;
ALTER TABLE admins ADD COLUMN role TEXT CHECK (role IN ('owner', 'manager'));
ALTER TABLE admins ADD COLUMN onboarding_completed_at TIMESTAMP;

ALTER TABLE venues ADD COLUMN address TEXT;
ALTER TABLE venues ADD COLUMN address_lat REAL;
ALTER TABLE venues ADD COLUMN address_lng REAL;
ALTER TABLE venues ADD COLUMN venue_type TEXT CHECK (venue_type IN ('discoteca', 'rock', 'musica_popular', 'otro'));
ALTER TABLE venues ADD COLUMN venue_type_other TEXT;
