-- ============================================================
-- Inceptive: connected_accounts table
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS connected_accounts (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider     TEXT NOT NULL,         -- 'gmail' | 'outlook' | 'twitter' | 'linkedin' | 'instagram' | 'facebook' | 'telegram' | 'tiktok' | 'youtube' | 'whatsapp'
  access_token TEXT,                  -- AES-256-GCM encrypted
  refresh_token TEXT,                 -- AES-256-GCM encrypted
  token_expiry TIMESTAMPTZ,
  account_email TEXT,
  account_name  TEXT,
  account_id    TEXT,                 -- Provider user/page/channel ID
  scope         TEXT,
  metadata      JSONB DEFAULT '{}',   -- Extra provider-specific data
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE connected_accounts ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (used by API routes)
CREATE POLICY "Service role full access"
  ON connected_accounts FOR ALL TO service_role USING (true);

-- Authenticated users can only read their own rows (tokens are never returned by the client)
CREATE POLICY "Users can view own connected accounts"
  ON connected_accounts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_connected_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER connected_accounts_updated_at
  BEFORE UPDATE ON connected_accounts
  FOR EACH ROW EXECUTE FUNCTION update_connected_accounts_updated_at();
