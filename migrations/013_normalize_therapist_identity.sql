-- =============================================
-- Migration: Normalize Therapist Identity
-- Purpose:
--   1. Ensure therapists.user_id exists and is populated.
--   2. Migrate legacy therapist rows that used a Google user id as therapists.id.
--   3. Create a canonical UUID-like therapist id for each therapist user.
--   4. Best-effort remap text-based therapist_id foreign keys to the canonical id.
-- Notes:
--   - This migration is schema-tolerant and targets real environments where
--     therapist tables may have drifted from the repo migrations.
--   - UUID-typed child tables cannot contain legacy non-UUID therapist ids, so
--     only text-like therapist_id columns are remapped here.
-- =============================================

BEGIN;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS legacy_id TEXT;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS license_number TEXT;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS specializations TEXT[];

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS bio TEXT;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh';

-- Backfill user_id from the old id pattern or matching email when possible.
UPDATE therapists AS t
SET user_id = u.id
FROM users AS u
WHERE t.user_id IS NULL
  AND (
    t.id::text = u.id
    OR (
      COALESCE(NULLIF(TRIM(t.email), ''), '__missing__') <> '__missing__'
      AND LOWER(t.email) = LOWER(u.email)
    )
  );

CREATE OR REPLACE FUNCTION miru_update_text_therapist_fk(p_table_name TEXT, p_old_id TEXT, p_new_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_data_type TEXT;
BEGIN
    SELECT data_type
    INTO v_data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = 'therapist_id';

    IF v_data_type IN ('text', 'character varying', 'character') THEN
        EXECUTE format(
            'UPDATE public.%I SET therapist_id = %L WHERE therapist_id = %L',
            p_table_name,
            p_new_id,
            p_old_id
        );
    END IF;
END;
$$;

DO $$
DECLARE
    rec RECORD;
    canonical_id TEXT;
    placeholder_email TEXT;
BEGIN
    FOR rec IN
        SELECT *
        FROM therapists
        WHERE user_id IS NOT NULL
          AND id::text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    LOOP
        SELECT t.id::text
        INTO canonical_id
        FROM therapists AS t
        WHERE t.user_id = rec.user_id
          AND t.id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        ORDER BY t.updated_at DESC NULLS LAST, t.created_at DESC NULLS LAST
        LIMIT 1;

        IF canonical_id IS NULL THEN
            canonical_id := gen_random_uuid()::text;

            placeholder_email := CASE
                WHEN COALESCE(NULLIF(TRIM(rec.email), ''), '') = '' THEN
                    format('legacy-%s@invalid.local', left(canonical_id, 12))
                ELSE
                    regexp_replace(
                        rec.email,
                        '@',
                        format('+legacy-%s@', left(canonical_id, 8)),
                        1,
                        1
                    )
            END;

            UPDATE therapists
            SET legacy_id = COALESCE(legacy_id, rec.id::text),
                user_id = NULL,
                email = placeholder_email,
                is_active = FALSE,
                updated_at = NOW()
            WHERE id = rec.id;

            INSERT INTO therapists (
                id,
                user_id,
                email,
                name,
                phone,
                license_number,
                specializations,
                bio,
                avatar_url,
                is_active,
                is_verified,
                timezone,
                created_at,
                updated_at
            )
            VALUES (
                canonical_id,
                rec.user_id,
                rec.email,
                rec.name,
                rec.phone,
                rec.license_number,
                rec.specializations,
                rec.bio,
                rec.avatar_url,
                COALESCE(rec.is_active, TRUE),
                COALESCE(rec.is_verified, FALSE),
                COALESCE(rec.timezone, 'Asia/Ho_Chi_Minh'),
                COALESCE(rec.created_at, NOW()),
                NOW()
            );
        ELSE
            placeholder_email := CASE
                WHEN COALESCE(NULLIF(TRIM(rec.email), ''), '') = '' THEN
                    format('legacy-%s@invalid.local', left(canonical_id, 12))
                ELSE
                    regexp_replace(
                        rec.email,
                        '@',
                        format('+legacy-%s@', left(canonical_id, 8)),
                        1,
                        1
                    )
            END;

            UPDATE therapists
            SET legacy_id = COALESCE(legacy_id, rec.id::text),
                user_id = NULL,
                email = placeholder_email,
                is_active = FALSE,
                updated_at = NOW()
            WHERE id = rec.id;
        END IF;

        PERFORM miru_update_text_therapist_fk('therapist_clients', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('assignments', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('appointments', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('crisis_events', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('therapist_client_messages', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('client_medical_profiles', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('therapist_session_notes', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('client_progress_metrics', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('therapist_client_groups', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('treatment_outcomes', rec.id::text, canonical_id);
        PERFORM miru_update_text_therapist_fk('privacy_consent_log', rec.id::text, canonical_id);
    END LOOP;
END;
$$;

DROP FUNCTION miru_update_text_therapist_fk(TEXT, TEXT, TEXT);

CREATE UNIQUE INDEX IF NOT EXISTS idx_therapists_user_id_unique
    ON therapists(user_id)
    WHERE user_id IS NOT NULL;

COMMIT;
