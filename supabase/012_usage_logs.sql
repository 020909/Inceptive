-- Create usage_logs table to monitor fallback AI usage
CREATE TABLE IF NOT EXISTS public.usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    usage_type TEXT NOT NULL, -- e.g. 'fallback', 'user_key'
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- Service role can read/write all
CREATE POLICY "Service role full access" ON public.usage_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can read their own logs
CREATE POLICY "Users can read own logs" ON public.usage_logs
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS usage_logs_user_id_idx ON public.usage_logs(user_id);
CREATE INDEX IF NOT EXISTS usage_logs_created_at_idx ON public.usage_logs(created_at);
