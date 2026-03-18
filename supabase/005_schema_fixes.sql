-- ============================================================
-- Inceptive: Schema fixes — run in Supabase SQL Editor
-- ============================================================

-- 1. Add api_model to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_model TEXT;

-- 2. Relax api_provider CHECK to include 'anthropic' and 'google'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;
ALTER TABLE public.users ADD CONSTRAINT users_api_provider_check
  CHECK (api_provider IN ('claude', 'anthropic', 'openai', 'google', 'gemini', 'openrouter'));

-- 3. Add created_at and metadata to emails
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.emails ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Fix social_posts: drop restrictive platform CHECK, add missing columns
ALTER TABLE public.social_posts DROP CONSTRAINT IF EXISTS social_posts_platform_check;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.social_posts ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Backfill scheduled_for from scheduled_at for existing rows
UPDATE public.social_posts
  SET scheduled_for = scheduled_at
  WHERE scheduled_for IS NULL AND scheduled_at IS NOT NULL;

-- 5. Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_emails_created ON public.emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_created ON public.social_posts(created_at DESC);
