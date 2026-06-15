-- Sprint 9C: Remove test team members (Jack doe, John doe) from production.
-- team_members uses name/display_name, not first_name/last_name.
-- Idempotent: safe to run on every deploy.

DELETE FROM team_members
WHERE LOWER(name) IN ('jack doe', 'john doe')
   OR (LOWER(display_name) IN ('jack', 'john') AND LOWER(name) LIKE '%doe%');
