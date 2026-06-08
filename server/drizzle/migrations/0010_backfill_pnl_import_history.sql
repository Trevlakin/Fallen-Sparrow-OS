-- One-time placeholder rows when data existed before import history was tracked.
INSERT INTO "pnl_import_history" (
  "import_type",
  "file_name",
  "row_count",
  "skipped_count",
  "imported_by_user_id",
  "summary_stats",
  "created_at"
)
SELECT
  'expenses',
  'Existing data (before CSV import log)',
  (SELECT COUNT(*)::int FROM "expenses"),
  0,
  (SELECT "id" FROM "users" WHERE "role" = 'OWNER' ORDER BY "created_at" LIMIT 1),
  '{"legacy":true}'::jsonb,
  COALESCE((SELECT MIN("created_at") FROM "expenses"), NOW())
WHERE NOT EXISTS (
  SELECT 1 FROM "pnl_import_history"
  WHERE "import_type" = 'expenses'
    AND "summary_stats"->>'legacy' = 'true'
)
  AND (SELECT COUNT(*) FROM "expenses") > 0
  AND EXISTS (SELECT 1 FROM "users" WHERE "role" = 'OWNER' LIMIT 1);
