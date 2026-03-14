-- =============================================
-- Migration: Web Push subscriptions
-- =============================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON push_subscriptions(user_id);

GRANT ALL ON push_subscriptions TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE push_subscriptions_id_seq TO anon, authenticated, service_role;
