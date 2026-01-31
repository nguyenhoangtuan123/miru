-- Migration: Add facts_content column to analyzed_sessions table
-- This allows storing parsed facts.txt content in the database

ALTER TABLE analyzed_sessions ADD COLUMN IF NOT EXISTS facts_content TEXT;

-- Index for faster queries on facts_content
CREATE INDEX IF NOT EXISTS idx_analyzed_sessions_facts ON analyzed_sessions(session_id) WHERE facts_content IS NOT NULL;
