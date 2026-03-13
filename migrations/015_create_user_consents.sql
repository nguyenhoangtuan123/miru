BEGIN;

CREATE TABLE IF NOT EXISTS user_consents (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    consent_version TEXT NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_at TIMESTAMPTZ,
    processing_consent BOOLEAN NOT NULL DEFAULT FALSE,
    crisis_notice_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    allow_proactive_support BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_accepted ON user_consents(accepted);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'user_consents'
          AND policyname = 'Users can manage own consent'
    ) THEN
        CREATE POLICY "Users can manage own consent" ON user_consents
            FOR ALL USING (auth.uid()::text = user_id)
            WITH CHECK (auth.uid()::text = user_id);
    END IF;
END;
$$;

GRANT ALL ON user_consents TO anon, authenticated, service_role;

COMMIT;
