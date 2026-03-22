-- 1. Create the agent_jobs table to store autonomous tasks
CREATE TABLE IF NOT EXISTS public.agent_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  kind text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  result jsonb,
  error text,
  logs jsonb DEFAULT '[]'::jsonb,
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  schedule_cron text,
  next_run_at timestamp with time zone DEFAULT now(),
  last_run_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.agent_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs" ON public.agent_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own jobs" ON public.agent_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own jobs" ON public.agent_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_jobs_next_run_at ON public.agent_jobs (next_run_at) WHERE status = 'pending';

-- 2. Add missing columns to user_credits to fix the 0 credits UI bug
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS is_subscriber BOOLEAN DEFAULT false;
ALTER TABLE public.user_credits ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMP WITH TIME ZONE;

-- 3. Create the connected_accounts table for OAuth connectors
CREATE TABLE IF NOT EXISTS public.connected_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider text NOT NULL,
  access_token text NOT NULL,
  account_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, provider)
);

ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own connections" ON public.connected_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own connections" ON public.connected_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own connections" ON public.connected_accounts
  FOR DELETE USING (auth.uid() = user_id);

