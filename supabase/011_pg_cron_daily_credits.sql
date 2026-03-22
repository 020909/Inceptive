-- Optional: reset free-tier credits daily at midnight UTC (requires pg_cron extension on Supabase).
-- In Dashboard → Database → Extensions → enable pg_cron, then run:

-- SELECT cron.schedule(
--   'inceptive-daily-credits',
--   '0 0 * * *',
--   $$UPDATE public.user_credits SET
--       credits_remaining = 100,
--       credits_total = 100,
--       period_start = NOW(),
--       period_end = NOW() + INTERVAL '1 day',
--       daily_reset_at = NOW() + INTERVAL '1 day',
--       updated_at = NOW()
--     WHERE plan = 'free'
--       AND is_subscriber IS NOT TRUE$$
-- );

-- If you do not use pg_cron, the app already resets when period_end passes (see getOrInitCredits).
