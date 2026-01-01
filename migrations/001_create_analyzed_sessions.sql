-- Migration: Create analyzed_sessions table
-- This table stores AI-analyzed conversation data

CREATE TABLE IF NOT EXISTS analyzed_sessions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER,  -- References session_summaries(id)
    user_id INTEGER,     -- References users(id)
    
    -- AI-extracted data
    emotion_score INTEGER CHECK (emotion_score >= 1 AND emotion_score <= 10),
    dominant_emotion VARCHAR(50),  -- 'vui', 'buồn', 'lo_lắng', etc
    topics TEXT[],                 -- Array of topics
    key_moments JSONB,             -- JSON array of key moments
    
    -- AI-generated content
    ai_summary TEXT,               -- Short summary
    ai_title VARCHAR(100),         -- Auto-generated title
    
    -- Metadata
    analyzed_at TIMESTAMP DEFAULT NOW(),
    analyzer_version VARCHAR(20) DEFAULT 'v1.0',
    
    -- Ensure one analysis per session
    UNIQUE(session_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analyzed_sessions_user ON analyzed_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_sessions_session ON analyzed_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_analyzed_sessions_analyzed_at ON analyzed_sessions(analyzed_at DESC);

-- Comments
COMMENT ON TABLE analyzed_sessions IS 'AI-analyzed conversation data for timeline and insights';
COMMENT ON COLUMN analyzed_sessions.emotion_score IS 'Overall emotion score from 1 (very negative) to 10 (very positive)';
COMMENT ON COLUMN analyzed_sessions.topics IS 'Array of conversation topics (max 3)';
COMMENT ON COLUMN analyzed_sessions.key_moments IS 'JSON array of important moments with importance scores';
