BEGIN;

DO $$
DECLARE
    therapist_id_type TEXT := 'text';
    user_id_type TEXT := 'text';
BEGIN
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO therapist_id_type
    FROM pg_attribute AS a
    JOIN pg_class AS c ON c.oid = a.attrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'therapists'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1;

    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO user_id_type
    FROM pg_attribute AS a
    JOIN pg_class AS c ON c.oid = a.attrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'users'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1;

    therapist_id_type := COALESCE(NULLIF(TRIM(therapist_id_type), ''), 'text');
    user_id_type := COALESCE(NULLIF(TRIM(user_id_type), ''), 'text');

    EXECUTE format(
        $sql$
        CREATE TABLE IF NOT EXISTS therapist_sharing_preferences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            client_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            therapist_id %s NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
            ai_chat_access TEXT NOT NULL DEFAULT 'none',
            web_activity_access TEXT NOT NULL DEFAULT 'none',
            assessment_access TEXT NOT NULL DEFAULT 'none',
            insights_access TEXT NOT NULL DEFAULT 'none',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (client_id, therapist_id)
        )
        $sql$,
        user_id_type,
        therapist_id_type
    );
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_sharing_preferences_ai_chat_access_check'
    ) THEN
        ALTER TABLE therapist_sharing_preferences
            ADD CONSTRAINT therapist_sharing_preferences_ai_chat_access_check
            CHECK (ai_chat_access IN ('none', 'ai_report', 'direct'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_sharing_preferences_web_activity_access_check'
    ) THEN
        ALTER TABLE therapist_sharing_preferences
            ADD CONSTRAINT therapist_sharing_preferences_web_activity_access_check
            CHECK (web_activity_access IN ('none', 'ai_report', 'direct'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_sharing_preferences_assessment_access_check'
    ) THEN
        ALTER TABLE therapist_sharing_preferences
            ADD CONSTRAINT therapist_sharing_preferences_assessment_access_check
            CHECK (assessment_access IN ('none', 'ai_report', 'direct'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_sharing_preferences_insights_access_check'
    ) THEN
        ALTER TABLE therapist_sharing_preferences
            ADD CONSTRAINT therapist_sharing_preferences_insights_access_check
            CHECK (insights_access IN ('none', 'ai_report', 'direct'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_therapist_sharing_preferences_client
    ON therapist_sharing_preferences(client_id);

CREATE INDEX IF NOT EXISTS idx_therapist_sharing_preferences_therapist
    ON therapist_sharing_preferences(therapist_id);

COMMIT;
