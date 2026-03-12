-- =============================================
-- Migration: Align role + goals schema
-- Purpose:
--   1. Add optional role columns used by the current backend.
--   2. Ensure the goals table exists in environments that skipped phase1_goals.sql.
-- =============================================

BEGIN;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT;

ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE users
SET role = 'therapist'
WHERE role IS NULL
  AND EXISTS (
    SELECT 1
    FROM therapists
    WHERE therapists.user_id = users.id
  );

UPDATE users
SET role = 'client'
WHERE role IS NULL;

UPDATE user_profiles
SET role = users.role
FROM users
WHERE user_profiles.user_id = users.id
  AND user_profiles.role IS NULL;

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

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_completed ON goals(user_id, completed);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'goals'
          AND policyname = 'Users can manage own goals'
    ) THEN
        CREATE POLICY "Users can manage own goals" ON goals
            FOR ALL USING (auth.uid()::text = user_id OR user_id = user_id);
    END IF;
END;
$$;

GRANT ALL ON goals TO anon, authenticated, service_role;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_class
        WHERE relname = 'goals_id_seq'
          AND relkind = 'S'
    ) THEN
        GRANT USAGE, SELECT ON SEQUENCE goals_id_seq TO anon, authenticated, service_role;
    END IF;
END;
$$;

COMMIT;
