-- Migration 007: Chat sessions + memory toggle
-- Run this in Supabase SQL Editor

-- 1. Add memory_enabled to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT FALSE;

-- 2. Create chat_sessions table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT          NOT NULL DEFAULT 'New Chat',
  messages    JSONB         NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- 3. RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can manage own chat sessions" ON public.chat_sessions;
CREATE POLICY "users can manage own chat sessions"
  ON public.chat_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Index for fast recent-chats lookup
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_created
  ON public.chat_sessions (user_id, created_at DESC);
