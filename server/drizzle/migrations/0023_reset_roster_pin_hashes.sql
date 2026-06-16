-- Ensure bcrypt hashes match manager PIN reference (name-only match).
UPDATE team_members
SET pin = '$2b$10$cYijghGSOX2VvmkDXwcuV.O0eW/ykRYQWWAMvDQkvdKe.4i4XhZLy',
    pin_plaintext = '9001',
    updated_at = now()
WHERE name = 'Legion Avegno';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$xS/5o2lz1NJ32L62VedymeXi295cvI1vwgYh0B635vUfedQsNssAu',
    pin_plaintext = '7723',
    updated_at = now()
WHERE name = 'Hector Morales';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$Bzcab53nyp1Y4Hex0mHCOeGnlXGSkxxDjmJPWRG8.4PEqZqttYVh2',
    pin_plaintext = '4412',
    updated_at = now()
WHERE name = 'Courtney Adams';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$AuDe5o7FPrvPW3JBPli9qeYbXeg7A4mAb2qeJmNlfFIfdEdrXjQKq',
    pin_plaintext = '7777',
    updated_at = now()
WHERE name = 'JP';
