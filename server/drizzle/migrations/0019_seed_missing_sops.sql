-- Sprint 9C: Seed missing SOP documents and checklist items (idempotent).
-- Plain SQL only (no DO blocks) so Drizzle migrator runs each statement cleanly.

-- Front Desk: Closing - add 5th checklist item if missing
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, 'Set alarm and lock up', 5, true, now()
FROM sops s
WHERE s.title = 'Front Desk: Closing'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = 'Set alarm and lock up'
  );
--> statement-breakpoint

-- Artist: Closing SOP
INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Artist: Closing', 'ARTIST', 'closing', 2, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Artist: Closing');
--> statement-breakpoint
INSERT INTO sop_role_assignments (id, sop_id, role)
SELECT gen_random_uuid(), s.id, 'ARTIST'
FROM sops s
WHERE s.title = 'Artist: Closing'
  AND NOT EXISTS (
    SELECT 1 FROM sop_role_assignments sra WHERE sra.sop_id = s.id AND sra.role = 'ARTIST'
  );
--> statement-breakpoint
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, v.label, v.sort_order, true, now()
FROM sops s
CROSS JOIN (VALUES
  ('Sterilize all equipment and surfaces', 1),
  ('Dispose of sharps and biohazard waste properly', 2),
  ('Restock station for tomorrow', 3),
  ('Log any supply shortages in Oracle', 4)
) AS v(label, sort_order)
WHERE s.title = 'Artist: Closing'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = v.label
  );
--> statement-breakpoint

-- Owner: Opening SOP
INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Owner: Opening', 'OWNER', 'opening', 1, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Owner: Opening');
--> statement-breakpoint
INSERT INTO sop_role_assignments (id, sop_id, role)
SELECT gen_random_uuid(), s.id, 'OWNER'
FROM sops s
WHERE s.title = 'Owner: Opening'
  AND NOT EXISTS (
    SELECT 1 FROM sop_role_assignments sra WHERE sra.sop_id = s.id AND sra.role = 'OWNER'
  );
--> statement-breakpoint
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, v.label, v.sort_order, true, now()
FROM sops s
CROSS JOIN (VALUES
  ('Review yesterday''s revenue and expenses', 1),
  ('Check team schedule and coverage', 2),
  ('Review open incidents and maintenance items', 3)
) AS v(label, sort_order)
WHERE s.title = 'Owner: Opening'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = v.label
  );
--> statement-breakpoint

-- Owner: Closing SOP
INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Owner: Closing', 'OWNER', 'closing', 2, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Owner: Closing');
--> statement-breakpoint
INSERT INTO sop_role_assignments (id, sop_id, role)
SELECT gen_random_uuid(), s.id, 'OWNER'
FROM sops s
WHERE s.title = 'Owner: Closing'
  AND NOT EXISTS (
    SELECT 1 FROM sop_role_assignments sra WHERE sra.sop_id = s.id AND sra.role = 'OWNER'
  );
--> statement-breakpoint
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, v.label, v.sort_order, true, now()
FROM sops s
CROSS JOIN (VALUES
  ('Review today''s revenue and cash reconciliation', 1),
  ('Confirm all checklists completed', 2),
  ('Set alarm and secure premises', 3)
) AS v(label, sort_order)
WHERE s.title = 'Owner: Closing'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = v.label
  );
--> statement-breakpoint

-- Manager: Daily SOP
INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Manager: Daily', 'MANAGER', 'daily', 1, true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM sops WHERE title = 'Manager: Daily');
--> statement-breakpoint
INSERT INTO sop_role_assignments (id, sop_id, role)
SELECT gen_random_uuid(), s.id, 'MANAGER'
FROM sops s
WHERE s.title = 'Manager: Daily'
  AND NOT EXISTS (
    SELECT 1 FROM sop_role_assignments sra WHERE sra.sop_id = s.id AND sra.role = 'MANAGER'
  );
--> statement-breakpoint
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, v.label, v.sort_order, true, now()
FROM sops s
CROSS JOIN (VALUES
  ('Walk the floor and check station readiness', 1),
  ('Review inventory low-stock alerts', 2),
  ('Check in with front desk on appointments', 3),
  ('Address any open maintenance incidents', 4)
) AS v(label, sort_order)
WHERE s.title = 'Manager: Daily'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = v.label
  );
--> statement-breakpoint

-- Cleaner: Daily SOP (role via sop_role_assignments)
INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
SELECT gen_random_uuid(), 'Cleaner: Daily', NULL, 'daily', 1, true, now(), now()
WHERE NOT EXISTS (
  SELECT 1
  FROM sops s
  JOIN sop_role_assignments sra ON sra.sop_id = s.id
  WHERE s.title = 'Cleaner: Daily' AND sra.role = 'CLEANER'
);
--> statement-breakpoint
INSERT INTO sop_role_assignments (id, sop_id, role)
SELECT gen_random_uuid(), s.id, 'CLEANER'
FROM sops s
WHERE s.title = 'Cleaner: Daily'
  AND NOT EXISTS (
    SELECT 1 FROM sop_role_assignments sra WHERE sra.sop_id = s.id AND sra.role = 'CLEANER'
  );
--> statement-breakpoint
INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
SELECT gen_random_uuid(), s.id, v.label, v.sort_order, true, now()
FROM sops s
CROSS JOIN (VALUES
  ('Mop all floors', 1),
  ('Wipe down all stations', 2),
  ('Clean and sanitize sinks', 3),
  ('Empty all trash', 4),
  ('Restock paper towels and soap', 5),
  ('Wipe mirrors', 6),
  ('Sweep entrance', 7)
) AS v(label, sort_order)
WHERE s.title = 'Cleaner: Daily'
  AND NOT EXISTS (
    SELECT 1 FROM sop_checklist_items sci
    WHERE sci.sop_id = s.id AND sci.label = v.label
  );
