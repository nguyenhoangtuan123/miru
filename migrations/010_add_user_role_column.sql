-- =============================================
-- Migration: Add role column to user_profiles
-- For role selection feature (client/therapist)
-- =============================================

-- Add role column to user_profiles
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('client', 'therapist'));

-- Create index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Comment
COMMENT ON COLUMN user_profiles.role IS 'User role: client (than chu) or therapist (nha tri lieu)';
