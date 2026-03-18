-- ============================================================
-- Inceptive: Schema fixes — run in Supabase SQL Editor
-- ============================================================

-- 1. Add api_model to users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS api_model TEXT;

-- 2. Remove api_provider constraint entirely — any string is valid now
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_api_provider_check;
-- (no new constraint — providers change over time, no need to restrict at DB level)

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
