-- Replace flat per-service commission rates with tiered session thresholds.
INSERT INTO settings (key, value)
VALUES (
  'commission_tiers',
  '{"tiers":[{"thresholdAmount":0,"artistPct":60,"shopPct":40,"sortOrder":1},{"thresholdAmount":1000,"artistPct":70,"shopPct":30,"sortOrder":2}],"updatedAt":null}'::jsonb
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = NOW();
