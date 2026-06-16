-- Manager PIN reference: store last-set plaintext for owner/manager display.
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS pin_plaintext varchar(4);

-- Seed defaults for the production roster (idempotent; only fills missing values).
UPDATE team_members SET pin_plaintext = '9001' WHERE name = 'Legion Avegno' AND pin_plaintext IS NULL;
UPDATE team_members SET pin_plaintext = '7723' WHERE name = 'Hector Morales' AND pin_plaintext IS NULL;
UPDATE team_members SET pin_plaintext = '4412' WHERE name = 'Courtney Adams' AND pin_plaintext IS NULL;
UPDATE team_members SET pin_plaintext = '7777' WHERE name = 'JP' AND pin_plaintext IS NULL;
