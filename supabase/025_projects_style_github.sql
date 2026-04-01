-- Inceptive v2: Projects + Style Memory
-- Run this migration in your Supabase SQL Editor

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  template text DEFAULT 'blank',
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  files jsonb DEFAULT '[]'::jsonb,
  settings jsonb DEFAULT '{}'::jsonb,
  github_repo text DEFAULT NULL,
  github_branch text DEFAULT 'main',
  last_opened_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(user_id, status);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Style Memory table (remembers user-preferred aesthetics across sessions)
CREATE TABLE IF NOT EXISTS style_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  preference_key text NOT NULL,
  preference_value text NOT NULL,
  context text DEFAULT 'global',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, preference_key, context)
);

CREATE INDEX IF NOT EXISTS idx_style_prefs_user ON style_preferences(user_id);

ALTER TABLE style_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own style preferences" ON style_preferences
  FOR ALL USING (auth.uid() = user_id);

-- GitHub connections table
CREATE TABLE IF NOT EXISTS github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  github_username text NOT NULL,
  access_token_encrypted text NOT NULL,
  repos jsonb DEFAULT '[]'::jsonb,
  connected_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE github_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own github connection" ON github_connections
  FOR ALL USING (auth.uid() = user_id);
