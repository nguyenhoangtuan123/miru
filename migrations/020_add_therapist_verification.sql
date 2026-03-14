BEGIN;

ALTER TABLE therapists
    ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'not_submitted',
    ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS verified_by_email TEXT,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS verification_full_name TEXT,
    ADD COLUMN IF NOT EXISTS verification_profession_title TEXT,
    ADD COLUMN IF NOT EXISTS verification_license_number TEXT,
    ADD COLUMN IF NOT EXISTS verification_issuing_organization TEXT,
    ADD COLUMN IF NOT EXISTS verification_note TEXT;

UPDATE therapists
SET verification_status = CASE
    WHEN COALESCE(is_verified, FALSE) THEN 'approved'
    ELSE COALESCE(NULLIF(verification_status, ''), 'not_submitted')
END
WHERE verification_status IS NULL
   OR verification_status = '';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapists_verification_status_check'
    ) THEN
        ALTER TABLE therapists
            ADD CONSTRAINT therapists_verification_status_check
            CHECK (verification_status IN ('not_submitted', 'pending', 'approved', 'rejected'));
    END IF;
END;
$$;

DO $$
DECLARE
    therapist_id_type TEXT;
BEGIN
    SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
    INTO therapist_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'therapists'
      AND a.attname = 'id'
      AND NOT a.attisdropped
      AND a.attnum > 0;

    IF therapist_id_type IS NULL THEN
        RAISE EXCEPTION 'Unable to determine therapists.id type';
    END IF;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS therapist_verification_documents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            therapist_id %s NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            file_name TEXT,
            mime_type TEXT,
            size_bytes BIGINT,
            uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )',
        therapist_id_type
    );
END;
$$;

CREATE INDEX IF NOT EXISTS idx_therapists_verification_status
    ON therapists(verification_status);

CREATE INDEX IF NOT EXISTS idx_verification_documents_therapist_id
    ON therapist_verification_documents(therapist_id);

COMMIT;
