-- 023_agent_memory_pgvector.sql — long-term memory with pgvector retrieval

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.agent_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(64), -- lightweight custom embedding for now
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_user_created
  ON public.agent_memory (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding
  ON public.agent_memory USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_agent_memory" ON public.agent_memory;
DROP POLICY IF EXISTS "users_insert_own_agent_memory" ON public.agent_memory;
DROP POLICY IF EXISTS "users_delete_own_agent_memory" ON public.agent_memory;

CREATE POLICY "users_select_own_agent_memory"
  ON public.agent_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_insert_own_agent_memory"
  ON public.agent_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_delete_own_agent_memory"
  ON public.agent_memory FOR DELETE
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.match_agent_memory(
  p_user_id uuid,
  p_query_embedding vector(64),
  p_match_count int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE sql
AS $$
  SELECT
    m.id,
    m.content,
    m.metadata,
    m.created_at,
    1 - (m.embedding <=> p_query_embedding) AS similarity
  FROM public.agent_memory m
  WHERE m.user_id = p_user_id
    AND m.embedding IS NOT NULL
  ORDER BY m.embedding <=> p_query_embedding
  LIMIT p_match_count;
$$;

