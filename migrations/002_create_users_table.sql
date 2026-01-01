-- Migration: Create or update users table for OAuth authentication
-- This handles the case where users table might already exist

-- Drop old users table if it exists (backup data first if needed!)
DROP TABLE IF EXISTS users CASCADE;

-- Create new users table with OAuth fields
CREATE TABLE users (
    id TEXT PRIMARY KEY,              -- Google user ID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,                     -- Profile picture URL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Grant permissions (adjust as needed for your Supabase setup)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
