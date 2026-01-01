-- Migration: Update session_summaries.user_id to TEXT type
-- This is needed because Google User IDs are strings and can exceed bigint range

-- Step 1: Drop foreign key constraint if exists
ALTER TABLE session_summaries 
DROP CONSTRAINT IF EXISTS session_summaries_user_id_fkey;

-- Step 2: Delete orphaned records (old data that doesn't match new users table)
-- This removes any session_summaries that reference non-existent users
DELETE FROM session_summaries 
WHERE user_id::TEXT NOT IN (SELECT id FROM users);

-- Step 3: Change user_id column type from bigint to text
ALTER TABLE session_summaries 
ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Step 4: Re-add foreign key constraint to users table
ALTER TABLE session_summaries 
ADD CONSTRAINT session_summaries_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Step 5: Update the match_summaries function to use TEXT type
CREATE OR REPLACE FUNCTION match_summaries (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  user_id_param text
)
RETURNS TABLE (
  id bigint,
  user_id text,
  summary_text text,
  created_at timestamp with time zone,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    session_summaries.id,
    session_summaries.user_id,
    session_summaries.summary_text,
    session_summaries.created_at,
    1 - (session_summaries.embedding <=> query_embedding) AS similarity
  FROM session_summaries
  WHERE 1 - (session_summaries.embedding <=> query_embedding) > match_threshold
  AND session_summaries.user_id = user_id_param
  ORDER BY session_summaries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
