-- ============================================================
-- 016_file_storage.sql — Real file workspace with Supabase Storage
-- Run in Supabase SQL Editor after prior migrations.
-- ============================================================

-- Enable pgvector for future semantic file search (optional but good to have)
CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. Files table — metadata for user files ─────────────────
CREATE TABLE IF NOT EXISTS public.user_files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  storage_path    TEXT NOT NULL, -- path in Supabase Storage bucket
  folder_path     TEXT NOT NULL DEFAULT '/', -- virtual folder path like '/Project Alpha'
  file_type       TEXT NOT NULL, -- text, code, image, spreadsheet, pdf, other
  mime_type       TEXT,
  size_bytes      INTEGER NOT NULL DEFAULT 0,
  content_preview TEXT, -- first 1000 chars for text files
  metadata        JSONB DEFAULT '{}'::jsonb, -- extra metadata like line count, dimensions for images
  is_folder       BOOLEAN NOT NULL DEFAULT FALSE,
  parent_id       UUID REFERENCES public.user_files(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_files_user_id ON public.user_files(user_id);
CREATE INDEX IF NOT EXISTS idx_user_files_folder_path ON public.user_files(user_id, folder_path);
CREATE INDEX IF NOT EXISTS idx_user_files_parent ON public.user_files(parent_id);
CREATE INDEX IF NOT EXISTS idx_user_files_type ON public.user_files(file_type);

-- ── 2. RLS Policies ───────────────────────────────────────────
ALTER TABLE public.user_files ENABLE ROW LEVEL SECURITY;

-- Users can read their own files
CREATE POLICY "users_select_own_files"
  ON public.user_files FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own files
CREATE POLICY "users_insert_own_files"
  ON public.user_files FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own files
CREATE POLICY "users_update_own_files"
  ON public.user_files FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own files
CREATE POLICY "users_delete_own_files"
  ON public.user_files FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "service_role_all_files"
  ON public.user_files FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ── 3. Updated at trigger ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_user_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_files_updated_at ON public.user_files;
CREATE TRIGGER user_files_updated_at
  BEFORE UPDATE ON public.user_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_files_updated_at();

-- ── 4. RPC: Get folder contents recursively ─────────────────
CREATE OR REPLACE FUNCTION public.get_folder_contents(
  p_user_id UUID,
  p_folder_path TEXT DEFAULT '/'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  folder_path TEXT,
  file_type TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  content_preview TEXT,
  is_folder BOOLEAN,
  parent_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  level INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE folder_tree AS (
    -- Base case: files in the target folder
    SELECT
      uf.id,
      uf.name,
      uf.folder_path,
      uf.file_type,
      uf.mime_type,
      uf.size_bytes,
      uf.content_preview,
      uf.is_folder,
      uf.parent_id,
      uf.created_at,
      uf.updated_at,
      0 as level
    FROM public.user_files uf
    WHERE uf.user_id = p_user_id
      AND uf.folder_path = p_folder_path
      AND uf.parent_id IS NULL

    UNION ALL

    -- Recursive case: children of folders
    SELECT
      uf.id,
      uf.name,
      uf.folder_path,
      uf.file_type,
      uf.mime_type,
      uf.size_bytes,
      uf.content_preview,
      uf.is_folder,
      uf.parent_id,
      uf.created_at,
      uf.updated_at,
      ft.level + 1
    FROM public.user_files uf
    INNER JOIN folder_tree ft ON uf.parent_id = ft.id
    WHERE uf.user_id = p_user_id
      AND ft.level < 10 -- prevent infinite recursion
  )
  SELECT * FROM folder_tree
  ORDER BY level, is_folder DESC, name;
END;
$$;

-- ── 5. RPC: Create folder ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_user_folder(
  p_user_id UUID,
  p_name TEXT,
  p_parent_id UUID DEFAULT NULL,
  p_folder_path TEXT DEFAULT '/'
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_folder_id UUID;
BEGIN
  INSERT INTO public.user_files (
    user_id,
    name,
    storage_path,
    folder_path,
    file_type,
    is_folder,
    parent_id,
    size_bytes
  ) VALUES (
    p_user_id,
    p_name,
    '', -- folders don't have storage path
    p_folder_path,
    'folder',
    TRUE,
    p_parent_id,
    0
  )
  RETURNING id INTO v_folder_id;

  RETURN v_folder_id;
END;
$$;

-- ── 6. Storage Bucket Setup (run in Supabase dashboard or via API)
-- Note: Create bucket 'user-files' with public: false
-- Folder structure: {user_id}/{file_id}/{filename}

COMMENT ON TABLE public.user_files IS 'User files metadata for the File Workspace';
