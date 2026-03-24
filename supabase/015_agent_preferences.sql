-- Migration: Add agent preferences for 24/7 mode and approval settings
-- Created: 2026-03-23

-- Add agent_preferences JSONB column to users table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS agent_preferences JSONB DEFAULT '{
  "is24_7Mode": false,
  "requiresApproval": false,
  "sleepAfterMinutes": 5,
  "autoSaveMemory": true,
  "defaultAgentMode": "auto"
}'::jsonb;

-- Add index for efficient querying of preferences
CREATE INDEX IF NOT EXISTS idx_users_agent_preferences
ON public.users USING GIN (agent_preferences);

-- Update existing users with default preferences if null
UPDATE public.users
SET agent_preferences = '{
  "is24_7Mode": false,
  "requiresApproval": false,
  "sleepAfterMinutes": 5,
  "autoSaveMemory": true,
  "defaultAgentMode": "auto"
}'::jsonb
WHERE agent_preferences IS NULL;

-- Grant permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

COMMENT ON COLUMN public.users.agent_preferences IS 'User preferences for agent behavior including 24/7 mode, approval settings, and memory options';
