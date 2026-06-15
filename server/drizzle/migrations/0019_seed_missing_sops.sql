-- Sprint 9C: Seed missing SOP documents and checklist items (idempotent).
-- Correct model: sops are documents; checklist items live in sop_checklist_items.

-- Front Desk: Closing - add 5th checklist item if missing
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Front Desk: Closing' LIMIT 1;
  IF sop_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM sop_checklist_items
      WHERE sop_id = sop_id AND label = 'Set alarm and lock up'
    ) THEN
      INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
      VALUES (gen_random_uuid(), sop_id, 'Set alarm and lock up', 5, true, now());
    END IF;
  END IF;
END $$;

-- Artist: Closing SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Artist: Closing' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Artist: Closing', 'ARTIST', 'closing', 2, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'ARTIST');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Sterilize all equipment and surfaces', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Dispose of sharps and biohazard waste properly', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Restock station for tomorrow', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Log any supply shortages in Oracle', 4, true, now());
  END IF;
END $$;

-- Owner: Opening SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Owner: Opening' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Owner: Opening', 'OWNER', 'opening', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'OWNER');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Review yesterday''s revenue and expenses', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Check team schedule and coverage', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Review open incidents and maintenance items', 3, true, now());
  END IF;
END $$;

-- Owner: Closing SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Owner: Closing' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Owner: Closing', 'OWNER', 'closing', 2, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'OWNER');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Review today''s revenue and cash reconciliation', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Confirm all checklists completed', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Set alarm and secure premises', 3, true, now());
  END IF;
END $$;

-- Manager: Daily SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Manager: Daily' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Manager: Daily', 'MANAGER', 'daily', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'MANAGER');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Walk the floor and check station readiness', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Review inventory low-stock alerts', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Check in with front desk on appointments', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Address any open maintenance incidents', 4, true, now());
  END IF;
END $$;

-- Cleaner: Daily SOP (role via sop_role_assignments)
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT s.id INTO sop_id
  FROM sops s
  JOIN sop_role_assignments sra ON sra.sop_id = s.id
  WHERE s.title = 'Cleaner: Daily' AND sra.role = 'CLEANER'
  LIMIT 1;

  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Cleaner: Daily', NULL, 'daily', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'CLEANER');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Mop all floors', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Wipe down all stations', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Clean and sanitize sinks', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Empty all trash', 4, true, now()),
      (gen_random_uuid(), sop_id, 'Restock paper towels and soap', 5, true, now()),
      (gen_random_uuid(), sop_id, 'Wipe mirrors', 6, true, now()),
      (gen_random_uuid(), sop_id, 'Sweep entrance', 7, true, now());
  END IF;
END $$;
