-- Migration 044: Add agent_permissions to profiles and account_invitations
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS agent_permissions TEXT[] DEFAULT ARRAY['inbox']::TEXT[];

ALTER TABLE account_invitations
  ADD COLUMN IF NOT EXISTS agent_permissions TEXT[] DEFAULT ARRAY['inbox']::TEXT[];
