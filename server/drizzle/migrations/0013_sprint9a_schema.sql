-- Sprint 9A schema additions

-- Change 4: link incident to its auto-created expense
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS linked_expense_id uuid,
  ADD COLUMN IF NOT EXISTS linked_expense_amount integer;

-- Change 7: AI expansion on strategic notes
ALTER TABLE strategic_notes
  ADD COLUMN IF NOT EXISTS ai_expansion text;

-- Change 6: client follow-up system
DO $$ BEGIN
  CREATE TYPE followup_type AS ENUM ('2_week', '1_month', '2_month', '6_month');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS client_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_phone text,
  artist_id uuid REFERENCES artists(id),
  appointment_date date NOT NULL,
  followup_type followup_type NOT NULL,
  due_date date NOT NULL,
  contacted_at timestamp,
  contact_notes text,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_followups_due_date_idx ON client_followups(due_date);
CREATE INDEX IF NOT EXISTS client_followups_artist_idx ON client_followups(artist_id);
CREATE INDEX IF NOT EXISTS client_followups_closed_idx ON client_followups(closed);
