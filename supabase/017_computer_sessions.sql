-- ============================================================
-- 017_computer_sessions.sql — Live browser session tracking
-- Run in Supabase SQL Editor after prior migrations.
-- ============================================================

-- ── 1. Computer Sessions table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.computer_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL DEFAULT 'default',
  status          TEXT NOT NULL DEFAULT 'active' -- active, paused, closed
    CHECK (status IN ('active', 'paused', 'closed')),
  current_url     TEXT,
  page_title     TEXT,
  viewport        JSONB DEFAULT '{"width":1280,"height":720}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  UNIQUE (user_id, session_id)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_computer_sessions_user ON public.computer_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_computer_sessions_activity ON public.computer_sessions(last_activity DESC);

-- ── 2. Session Actions Log ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.computer_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL DEFAULT 'default',
  action_type     TEXT NOT NULL -- goto, click, type, scroll, screenshot, etc.
    CHECK (action_type IN ('goto', 'click', 'type', 'scroll', 'screenshot', 'moveMouse', 'analyze')),
  action_data     JSONB NOT NULL DEFAULT '{}'::jsonb, -- {url, x, y, text, etc.}
  screenshot_id   UUID, -- reference to screenshot if taken
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_computer_actions_session ON public.computer_actions(user_id, session_id, created_at DESC);

-- ── 3. Screenshots table ─────────────────────────────────────
-- Stores screenshot metadata (actual images in storage bucket)
CREATE TABLE IF NOT EXISTS public.computer_screenshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id      TEXT NOT NULL DEFAULT 'default',
  storage_path    TEXT NOT NULL, -- path in storage bucket
  url             TEXT, -- URL at time of screenshot
  action_id       UUID REFERENCES public.computer_actions(id),
  width           INTEGER,
  height          INTEGER,
  vision_summary  TEXT, -- AI-generated description of screenshot
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_computer_screenshots_session ON public.computer_screenshots(user_id, session_id, created_at DESC);

-- ── 4. RLS Policies ──────────────────────────────────────────
ALTER TABLE public.computer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.computer_screenshots ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "users_select_own_computer_sessions"
  ON public.computer_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all
CREATE POLICY "service_role_computer_sessions"
  ON public.computer_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read their own actions
CREATE POLICY "users_select_own_computer_actions"
  ON public.computer_actions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all actions
CREATE POLICY "service_role_computer_actions"
  ON public.computer_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Users can read their own screenshots
CREATE POLICY "users_select_own_computer_screenshots"
  ON public.computer_screenshots FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Service role can manage all screenshots
CREATE POLICY "service_role_computer_screenshots"
  ON public.computer_screenshots FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 5. Functions ─────────────────────────────────────────────

-- Get or create a session
CREATE OR REPLACE FUNCTION public.get_or_create_computer_session(
  p_user_id UUID,
  p_session_id TEXT DEFAULT 'default'
)
RETURNS public.computer_sessions LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_session public.computer_sessions;
BEGIN
  -- Try to get existing active session
  SELECT * INTO v_session
  FROM public.computer_sessions
  WHERE user_id = p_user_id
    AND session_id = p_session_id
    AND status = 'active'
  LIMIT 1;

  -- If not found or closed, create new
  IF NOT FOUND OR v_session.status = 'closed' THEN
    INSERT INTO public.computer_sessions (user_id, session_id, status)
    VALUES (p_user_id, p_session_id, 'active')
    ON CONFLICT (user_id, session_id)
    DO UPDATE SET status = 'active', closed_at = NULL, last_activity = NOW()
    RETURNING * INTO v_session;
  END IF;

  RETURN v_session;
END;
$$;

-- Log computer action
CREATE OR REPLACE FUNCTION public.log_computer_action(
  p_user_id UUID,
  p_session_id TEXT,
  p_action_type TEXT,
  p_action_data JSONB DEFAULT '{}'::jsonb,
  p_screenshot_id UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_action_id UUID;
BEGIN
  INSERT INTO public.computer_actions (
    user_id, session_id, action_type, action_data, screenshot_id
  ) VALUES (
    p_user_id, p_session_id, p_action_type, p_action_data, p_screenshot_id
  )
  RETURNING id INTO v_action_id;

  -- Update session last_activity
  UPDATE public.computer_sessions
  SET last_activity = NOW()
  WHERE user_id = p_user_id AND session_id = p_session_id;

  RETURN v_action_id;
END;
$$;

-- Get recent session activity with screenshots
CREATE OR REPLACE FUNCTION public.get_session_activity(
  p_user_id UUID,
  p_session_id TEXT DEFAULT 'default',
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  action_id UUID,
  action_type TEXT,
  action_data JSONB,
  screenshot_id UUID,
  screenshot_url TEXT,
  vision_summary TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id as action_id,
    ca.action_type,
    ca.action_data,
    cs.id as screenshot_id,
    cs.storage_path as screenshot_url,
    cs.vision_summary,
    ca.created_at
  FROM public.computer_actions ca
  LEFT JOIN public.computer_screenshots cs ON ca.screenshot_id = cs.id
  WHERE ca.user_id = p_user_id
    AND ca.session_id = p_session_id
  ORDER BY ca.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ── 6. Storage bucket setup ─────────────────────────────────
-- Create 'computer-screenshots' bucket in Supabase dashboard
-- Folder structure: {user_id}/{session_id}/{timestamp}_{action}.png

COMMENT ON TABLE public.computer_sessions IS 'Active browser automation sessions per user';
COMMENT ON TABLE public.computer_actions IS 'Log of all browser automation actions';
COMMENT ON TABLE public.computer_screenshots IS 'Screenshots taken during browser sessions';
