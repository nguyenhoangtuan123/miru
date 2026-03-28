-- Add embedding column + vector search RPC for article-level semantic retrieval.
-- Uses pgvector (already enabled for session_summaries).    
-- gemini-embedding-001 with output_dimensionality=768.

BEGIN;

-- 1. Ensure pgvector extension exists
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding column
ALTER TABLE public.therapist_articles
    ADD COLUMN IF NOT EXISTS embedding vector(768);

-- 3. Create HNSW index for cosine distance (only useful rows)
CREATE INDEX IF NOT EXISTS idx_therapist_articles_embedding
    ON public.therapist_articles
    USING hnsw (embedding vector_cosine_ops);

-- 4. RPC for semantic article search
CREATE OR REPLACE FUNCTION match_therapist_articles(
    query_embedding vector(768),
    match_count int DEFAULT 3,
    match_threshold float DEFAULT 0.35
)
RETURNS TABLE (
    id bigint,
    therapist_id text,
    title text,
    slug text,
    excerpt text,
    cover_image_url text,
    seo_description text,
    published_at timestamptz,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.therapist_id::text,
        a.title,
        a.slug,
        a.excerpt,
        a.cover_image_url,
        a.seo_description,
        a.published_at,
        (1 - (a.embedding <=> query_embedding))::float AS similarity
    FROM public.therapist_articles a
    WHERE
        a.status = 'published'
        AND a.embedding IS NOT NULL
        AND (1 - (a.embedding <=> query_embedding)) > match_threshold
    ORDER BY a.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

COMMIT;
