-- Optional UI display date for knowledge entries uploaded on 2026-06-18 (show as May 18 in the app).
-- New uploads keep real created_at; only entries without display_date are backfilled.

UPDATE public.knowledge_entries
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'display_date',
  to_char(
    ((created_at AT TIME ZONE 'UTC')::date - interval '1 month')::timestamptz,
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
)
WHERE (created_at AT TIME ZONE 'UTC')::date = DATE '2026-06-18'
  AND NOT (COALESCE(metadata, '{}'::jsonb) ? 'display_date');
