-- Add missing columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS api_provider TEXT DEFAULT 'gemini';

-- Ensure the constraint allows openrouter
DO $$ 
BEGIN 
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_api_provider_check;
  ALTER TABLE users ADD CONSTRAINT users_api_provider_check CHECK (api_provider IN ('claude', 'openai', 'gemini', 'openrouter'));
EXCEPTION 
  WHEN undefined_object THEN NULL; 
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS wake_time TEXT DEFAULT '06:47';
ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Create users row automatically when someone signs up via Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, created_at)
  VALUES (new.id, new.email, now())
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Insert row for any existing auth users who don't have a users row yet
INSERT INTO public.users (id, email, created_at)
SELECT id, email, created_at FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can view own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can view own data" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (auth.uid() = id);
