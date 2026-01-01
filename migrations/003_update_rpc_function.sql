-- Update session_summaries table to reference new users table
-- Also update the match_summaries function

-- 1. Update session_summaries foreign key
-- We need to ensure session_summaries.user_id references users.id (which is TEXT now)

-- Drop existing foreign key if needed (might be auto-named, so we try to alter column directly)
-- ALTER TABLE session_summaries DROP CONSTRAINT IF EXISTS session_summaries_user_id_fkey;

-- Since we recreated users table, the old FK might be broken or gone.
-- Let's ensure session_summaries.user_id is TEXT to match users.id
-- (Assuming it was INT or UUID before, but users.id is now TEXT from Google)

-- ALTER TABLE session_summaries ALTER COLUMN user_id TYPE TEXT;

-- Re-add foreign key
-- ALTER TABLE session_summaries 
-- ADD CONSTRAINT session_summaries_user_id_fkey 
-- FOREIGN KEY (user_id) REFERENCES users(id);


-- 2. Update match_summaries function to use new user_id param
CREATE OR REPLACE FUNCTION match_summaries (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  user_id_param text  -- Changed from user_id_str_param
)
RETURNS TABLE (
  id bigint,
  user_id text,       -- Changed type to text
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
  AND session_summaries.user_id = user_id_param -- Filter by user_id
  ORDER BY session_summaries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
