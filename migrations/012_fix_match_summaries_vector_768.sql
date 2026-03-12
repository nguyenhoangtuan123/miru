-- Align semantic search RPC with Gemini text-embedding-004 (768 dimensions)
-- Run this on Supabase after the existing migrations.

CREATE OR REPLACE FUNCTION match_summaries (
  query_embedding vector(768),
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
