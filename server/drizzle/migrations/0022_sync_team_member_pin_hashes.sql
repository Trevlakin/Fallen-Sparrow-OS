-- Sync bcrypt PIN hashes with manager-visible pin_plaintext values.
UPDATE team_members
SET pin = '$2b$10$cYijghGSOX2VvmkDXwcuV.O0eW/ykRYQWWAMvDQkvdKe.4i4XhZLy', updated_at = now()
WHERE name = 'Legion Avegno' AND pin_plaintext = '9001';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$xS/5o2lz1NJ32L62VedymeXi295cvI1vwgYh0B635vUfedQsNssAu', updated_at = now()
WHERE name = 'Hector Morales' AND pin_plaintext = '7723';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$Bzcab53nyp1Y4Hex0mHCOeGnlXGSkxxDjmJPWRG8.4PEqZqttYVh2', updated_at = now()
WHERE name = 'Courtney Adams' AND pin_plaintext = '4412';
--> statement-breakpoint
UPDATE team_members
SET pin = '$2b$10$AuDe5o7FPrvPW3JBPli9qeYbXeg7A4mAb2qeJmNlfFIfdEdrXjQKq', updated_at = now()
WHERE name = 'JP' AND pin_plaintext = '7777';
