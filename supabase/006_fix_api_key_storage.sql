-- ============================================================
-- INCEPTIVE: Fix API key storage — run this in Supabase SQL Editor
-- This fixes the "No API key found" error permanently.
-- ============================================================

-- 1. Add api_model column (needed for model selection)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_model TEXT;

-- 2. Remove the api_provider constraint that blocks saving certain providers
--    (any string should be valid — anthropic, openai, google, openrouter, etc.)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;

-- 3. Make sure api_key_encrypted and api_provider columns exist
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_provider TEXT;

-- 4. Remove any default that forces api_provider to a specific value
ALTER TABLE public.users ALTER COLUMN api_provider DROP DEFAULT;

-- Done. You should now be able to save any provider (openrouter, anthropic, openai, etc.)
-- and have the key persist correctly.
