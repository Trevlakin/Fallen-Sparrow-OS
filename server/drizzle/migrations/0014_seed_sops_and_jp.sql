-- Sprint 9A: Seed SOP templates for FRONT_DESK, ARTIST, MAINTENANCE roles

-- FRONT_DESK Opening SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Front Desk: Opening' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Front Desk: Opening', 'FRONT_DESK', 'opening', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'FRONT_DESK');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Check appointment schedule for today', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Confirm deposits on file for today''s bookings', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Turn on all equipment and station lighting', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Restock front desk supplies', 4, true, now()),
      (gen_random_uuid(), sop_id, 'Check and respond to overnight messages', 5, true, now());
  END IF;
END $$;

-- FRONT_DESK Closing SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Front Desk: Closing' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Front Desk: Closing', 'FRONT_DESK', 'closing', 2, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'FRONT_DESK');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Reconcile cash payments from today', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Confirm tomorrow''s appointments', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Wipe down front desk and waiting area', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Lock display cases', 4, true, now());
  END IF;
END $$;

-- ARTIST Opening SOP
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT id INTO sop_id FROM sops WHERE title = 'Artist: Opening' LIMIT 1;
  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Artist: Opening', 'ARTIST', 'opening', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'ARTIST');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Sterilize workstation', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Stock needles and ink for today''s bookings', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Review client notes for today', 3, true, now());
  END IF;
END $$;

-- MAINTENANCE Daily SOP (role stored via sop_role_assignments since MAINTENANCE not in user_role enum)
DO $$
DECLARE
  sop_id uuid;
BEGIN
  SELECT s.id INTO sop_id
  FROM sops s
  JOIN sop_role_assignments sra ON sra.sop_id = s.id
  WHERE s.title = 'Maintenance: Daily' AND sra.role = 'MAINTENANCE'
  LIMIT 1;

  IF sop_id IS NULL THEN
    sop_id := gen_random_uuid();
    INSERT INTO sops (id, title, role, frequency, sort_order, is_active, created_at, updated_at)
    VALUES (sop_id, 'Maintenance: Daily', NULL, 'daily', 1, true, now(), now());
    INSERT INTO sop_role_assignments (id, sop_id, role)
    VALUES (gen_random_uuid(), sop_id, 'MAINTENANCE');
    INSERT INTO sop_checklist_items (id, sop_id, label, sort_order, is_active, created_at)
    VALUES
      (gen_random_uuid(), sop_id, 'Check common areas for cleanliness', 1, true, now()),
      (gen_random_uuid(), sop_id, 'Inspect and restock cleaning supplies', 2, true, now()),
      (gen_random_uuid(), sop_id, 'Check for open maintenance incidents', 3, true, now()),
      (gen_random_uuid(), sop_id, 'Confirm AC and equipment are operational', 4, true, now());
  END IF;
END $$;

-- JP test user is seeded via server/src/db/seed.ts (requires bcrypt PIN hashing)
