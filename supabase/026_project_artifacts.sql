-- Inceptive: Project artifacts
-- Run this after 025_projects_style_github.sql

CREATE TABLE IF NOT EXISTS project_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('website', 'image', 'powerpoint', 'excel', 'pdf', 'report', 'file', 'other')),
  title text NOT NULL,
  source text DEFAULT 'manual',
  status text DEFAULT 'ready' CHECK (status IN ('draft', 'ready', 'archived')),
  summary text DEFAULT '',
  content_text text DEFAULT NULL,
  content_json jsonb DEFAULT '{}'::jsonb,
  file_name text DEFAULT NULL,
  mime_type text DEFAULT NULL,
  preview_url text DEFAULT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_project_created
  ON project_artifacts(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_artifacts_user_type
  ON project_artifacts(user_id, type, created_at DESC);

ALTER TABLE project_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own project artifacts" ON project_artifacts
  FOR ALL USING (auth.uid() = user_id);
