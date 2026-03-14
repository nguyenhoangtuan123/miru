-- =============================================
-- Migration: Public therapist profiles + private client profiles
-- Notes:
--   - Real environments may have schema drift.
--   - This migration reads the actual column types from therapists.id and
--     users.id, then creates profile tables with matching FK column types.
-- =============================================

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
        CREATE TABLE IF NOT EXISTS therapist_public_profiles (
            therapist_id %s PRIMARY KEY REFERENCES therapists(id) ON DELETE CASCADE,
            display_name TEXT,
            headline TEXT,
            bio TEXT,
            specializations TEXT[] DEFAULT ARRAY[]::TEXT[],
            contact_phone TEXT,
            contact_email TEXT,
            contact_zalo_url TEXT,
            contact_facebook_url TEXT,
            contact_website_url TEXT,
            avatar_image JSONB,
            certificate_images JSONB DEFAULT '[]'::JSONB,
            is_public BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        $sql$,
        therapist_id_type
    );

    EXECUTE format(
        $sql$
        CREATE TABLE IF NOT EXISTS client_private_profiles (
            user_id %s PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            intro TEXT,
            avatar_image JSONB,
            gallery_images JSONB DEFAULT '[]'::JSONB,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
        $sql$,
        user_id_type
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_therapist_public_profiles_public
    ON therapist_public_profiles(is_public);
