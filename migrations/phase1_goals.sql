-- =============================================
-- Miru Database Migrations - Phase 1 Features
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Goals Table
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_completed ON goals(user_id, completed);

-- Enable RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own goals
CREATE POLICY "Users can manage own goals" ON goals
    FOR ALL USING (auth.uid()::text = user_id OR user_id = user_id);

-- 2. Push Subscriptions Table (for future Web Push)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- 3. (Already exists from therapist_service.py)
-- Run if not exists: therapists, therapist_clients, assignments, crisis_events

-- =============================================
-- GRANT permissions for anonymous/service role
-- =============================================
GRANT ALL ON goals TO anon, authenticated, service_role;
GRANT ALL ON push_subscriptions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE goals_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO anon, authenticated, service_role;
