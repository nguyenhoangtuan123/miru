BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'therapist_public_profiles'
    ) THEN
        UPDATE therapists AS t
        SET verification_status = 'approved',
            is_verified = TRUE,
            verified_at = COALESCE(t.verified_at, NOW()),
            updated_at = NOW()
        WHERE EXISTS (
            SELECT 1
            FROM therapist_public_profiles AS p
            WHERE p.therapist_id = t.id
              AND COALESCE(p.is_public, FALSE) = TRUE
        )
          AND COALESCE(NULLIF(t.verification_status, ''), 'not_submitted') = 'not_submitted'
          AND COALESCE(t.is_active, TRUE) = TRUE;
    END IF;
END;
$$;

COMMIT;
