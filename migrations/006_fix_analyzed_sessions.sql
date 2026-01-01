-- Migration: Fix analyzed_sessions table for Google User IDs
-- Change user_id from INTEGER to TEXT to match users table

-- 1. Drop foreign key if exists
ALTER TABLE analyzed_sessions 
DROP CONSTRAINT IF EXISTS analyzed_sessions_user_id_fkey;

-- 2. Delete old data (incompatible user IDs)
DELETE FROM analyzed_sessions;

-- 3. Change user_id column type
ALTER TABLE analyzed_sessions 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- 4. Re-add foreign key
ALTER TABLE analyzed_sessions 
ADD CONSTRAINT analyzed_sessions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 5. Also fix session_id to be BIGINT to match session_summaries.id
ALTER TABLE analyzed_sessions 
ALTER COLUMN session_id TYPE BIGINT;

-- 6. Add foreign key for session_id if not exists
ALTER TABLE analyzed_sessions 
DROP CONSTRAINT IF EXISTS analyzed_sessions_session_id_fkey;

ALTER TABLE analyzed_sessions 
ADD CONSTRAINT analyzed_sessions_session_id_fkey 
FOREIGN KEY (session_id) REFERENCES session_summaries(id) ON DELETE CASCADE;
