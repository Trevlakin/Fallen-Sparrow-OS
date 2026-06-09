-- Studio day cutoff backfill (data-only migration, no schema change).
--
-- Session dates now follow the 4 AM Eastern studio-day rule: work logged
-- between midnight and 4 AM Eastern belongs to the PREVIOUS studio day.
-- Rows written under the old midnight rule (or a UTC date) can sit under the
-- wrong session_date, e.g. items checked at 12:32 AM Eastern Tuesday were
-- filed under Tuesday and showed as already complete all day.
--
-- sop_completions: delete misfiled rows. The read path already hides them
-- (completed_at studio day must match session_date), so deleting matches what
-- users see and avoids unique-index collisions on re-dating.
-- completed_at is timestamp without time zone, stored as UTC.

DELETE FROM sop_completions
WHERE completed_at IS NOT NULL
  AND session_date <> (
    ((completed_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
      - interval '4 hours')::date
  );
--> statement-breakpoint

-- extra_tasks: re-date instead of delete (no unique constraints; tasks carry
-- real user-entered content that must not be lost).
UPDATE extra_tasks
SET session_date = (
  ((logged_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
    - interval '4 hours')::date
)
WHERE session_date <> (
  ((logged_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')
    - interval '4 hours')::date
);
