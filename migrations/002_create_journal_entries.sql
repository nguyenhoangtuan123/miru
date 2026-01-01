-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    content TEXT,
    mood VARCHAR(50), -- 'happy', 'sad', 'neutral', 'anxious', 'excited'
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id);

-- Create index for sorting by date
CREATE INDEX IF NOT EXISTS idx_journal_created_at ON journal_entries(created_at);
