-- 020_connected_accounts_encrypted_tokens.sql
-- Add encrypted_tokens JSONB column expected by connector libs.

ALTER TABLE public.connected_accounts
  ADD COLUMN IF NOT EXISTS encrypted_tokens JSONB;

-- Backfill: if existing access_token/refresh_token are present, mirror them into encrypted_tokens.
-- NOTE: access_token/refresh_token are already encrypted strings in this codebase.
UPDATE public.connected_accounts
SET encrypted_tokens = jsonb_strip_nulls(
  jsonb_build_object(
    'access_token', access_token,
    'refresh_token', refresh_token
  )
)
WHERE encrypted_tokens IS NULL
  AND (access_token IS NOT NULL OR refresh_token IS NOT NULL);

