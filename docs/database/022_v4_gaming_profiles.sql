-- V4 Gaming Profile Enhancement
-- Adds gaming identity fields to profiles (verified before application)
-- Safe migration: IF NOT EXISTS for new columns
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS gaming_handle TEXT,
ADD COLUMN IF NOT EXISTS platforms TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS favorite_games TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS play_style TEXT,
ADD COLUMN IF NOT EXISTS lfg_available BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS presence_state TEXT DEFAULT 'offline';
-- Index for gaming discovery
CREATE INDEX IF NOT EXISTS idx_profiles_gaming_handle ON profiles(gaming_handle);
CREATE INDEX IF NOT EXISTS idx_profiles_presence ON profiles(presence_state) WHERE presence_state = 'online';
