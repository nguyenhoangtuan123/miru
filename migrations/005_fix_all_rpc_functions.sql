-- Complete migration to fix all RPC functions for new schema
-- Run this on Supabase SQL Editor

-- 1. Update match_summaries function (for semantic search)
CREATE OR REPLACE FUNCTION match_summaries (
  query_embedding vector(384),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 3,
  user_id_param text DEFAULT NULL
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
  WHERE 
    (user_id_param IS NULL OR session_summaries.user_id = user_id_param)
    AND (1 - (session_summaries.embedding <=> query_embedding)) > match_threshold
  ORDER BY session_summaries.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 2. Verify session_summaries table structure
-- Check if user_id is TEXT type
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session_summaries' 
AND column_name = 'user_id';

-- 3. Check if there are any records
SELECT COUNT(*) as total_records FROM session_summaries;

-- 4. Check users table
SELECT id, email, name FROM users LIMIT 5;
