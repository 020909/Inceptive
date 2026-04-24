-- Security hardening: prevent public access to rate limiting state.
-- This table should be managed server-side only (service_role key).
alter table public.rate_limits enable row level security;

-- Defense in depth: revoke direct table privileges from API roles.
revoke all on table public.rate_limits from anon, authenticated;
