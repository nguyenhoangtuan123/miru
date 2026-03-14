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

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS assessment_templates (
            id TEXT PRIMARY KEY,
            short_code TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            instructions TEXT,
            question_count INTEGER NOT NULL DEFAULT 0,
            scoring_mode TEXT NOT NULL DEFAULT 'total_score',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    $sql$;

    EXECUTE $sql$
        CREATE TABLE IF NOT EXISTS assessment_questions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            template_id TEXT NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
            order_index INTEGER NOT NULL,
            key TEXT NOT NULL,
            prompt TEXT NOT NULL,
            choices JSONB NOT NULL DEFAULT '[]'::JSONB,
            subscale TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (template_id, order_index),
            UNIQUE (template_id, key)
        )
    $sql$;

    EXECUTE format(
        $sql$
        CREATE TABLE IF NOT EXISTS assessment_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            template_id TEXT NOT NULL REFERENCES assessment_templates(id) ON DELETE RESTRICT,
            therapist_id %s NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
            client_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status TEXT NOT NULL DEFAULT 'assigned',
            therapist_note TEXT,
            due_date TIMESTAMPTZ,
            assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        $sql$,
        therapist_id_type,
        user_id_type
    );

    EXECUTE format(
        $sql$
        CREATE TABLE IF NOT EXISTS assessment_results (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            assignment_id UUID NOT NULL UNIQUE REFERENCES assessment_assignments(id) ON DELETE CASCADE,
            template_id TEXT NOT NULL REFERENCES assessment_templates(id) ON DELETE CASCADE,
            therapist_id %s NOT NULL REFERENCES therapists(id) ON DELETE CASCADE,
            client_id %s NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            total_score INTEGER,
            severity TEXT,
            interpretation TEXT,
            subscale_scores JSONB NOT NULL DEFAULT '{}'::JSONB,
            answer_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB,
            completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        $sql$,
        therapist_id_type,
        user_id_type
    );
END $$;

CREATE TABLE IF NOT EXISTS assessment_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL REFERENCES assessment_assignments(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES assessment_questions(id) ON DELETE CASCADE,
    answer_value INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (assignment_id, question_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assessment_assignments_status_check'
    ) THEN
        ALTER TABLE assessment_assignments
            ADD CONSTRAINT assessment_assignments_status_check
            CHECK (status IN ('assigned', 'completed', 'cancelled'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'assessment_answers_value_check'
    ) THEN
        ALTER TABLE assessment_answers
            ADD CONSTRAINT assessment_answers_value_check
            CHECK (answer_value BETWEEN 0 AND 3);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_assessment_questions_template
    ON assessment_questions(template_id, order_index);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_therapist
    ON assessment_assignments(therapist_id, client_id, status);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_client
    ON assessment_assignments(client_id, status, assigned_at DESC);

CREATE INDEX IF NOT EXISTS idx_assessment_results_assignment
    ON assessment_results(assignment_id);

COMMIT;
