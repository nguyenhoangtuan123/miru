DO $$
DECLARE
    user_id_type TEXT;
    therapist_id_type TEXT;
BEGIN
    SELECT format_type(a.atttypid, a.atttypmod)
    INTO user_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'users'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1;

    IF user_id_type IS NULL THEN
        user_id_type := 'text';
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod)
    INTO therapist_id_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'therapists'
      AND a.attname = 'id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    LIMIT 1;

    IF therapist_id_type IS NULL THEN
        therapist_id_type := 'text';
    END IF;

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.treatment_programs (
            id BIGSERIAL PRIMARY KEY,
            client_id %1$s REFERENCES public.users(id) ON DELETE CASCADE,
            therapist_id %2$s REFERENCES public.therapists(id) ON DELETE CASCADE,
            title TEXT,
            status TEXT NOT NULL DEFAULT ''draft'' CHECK (status IN (''draft'', ''published'', ''archived'')),
            approaches TEXT[] DEFAULT ARRAY[]::TEXT[],
            summary TEXT,
            total_sessions INTEGER,
            start_date DATE,
            review_date DATE,
            published_at TIMESTAMPTZ,
            archived_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )',
        user_id_type,
        therapist_id_type
    );

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.treatment_goals (
            id BIGSERIAL PRIMARY KEY,
            program_id BIGINT REFERENCES public.treatment_programs(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            success_criteria TEXT,
            status TEXT NOT NULL DEFAULT ''not_started'' CHECK (status IN (''not_started'', ''in_progress'', ''achieved'', ''paused'')),
            order_index INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )'
    );

    EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.treatment_session_plans (
            id BIGSERIAL PRIMARY KEY,
            program_id BIGINT REFERENCES public.treatment_programs(id) ON DELETE CASCADE,
            session_number INTEGER NOT NULL,
            title TEXT,
            objectives TEXT,
            interventions TEXT,
            homework_plan TEXT,
            status TEXT NOT NULL DEFAULT ''planned'' CHECK (status IN (''planned'', ''completed'', ''skipped'')),
            scheduled_for TIMESTAMPTZ,
            appointment_id BIGINT,
            session_note_id BIGINT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )'
    );
END $$;

CREATE INDEX IF NOT EXISTS idx_treatment_programs_client ON public.treatment_programs(client_id);
CREATE INDEX IF NOT EXISTS idx_treatment_programs_therapist ON public.treatment_programs(therapist_id);
CREATE INDEX IF NOT EXISTS idx_treatment_programs_status ON public.treatment_programs(status);
CREATE INDEX IF NOT EXISTS idx_treatment_programs_active
    ON public.treatment_programs(client_id, therapist_id)
    WHERE status <> 'archived';

CREATE INDEX IF NOT EXISTS idx_treatment_goals_program ON public.treatment_goals(program_id);
CREATE INDEX IF NOT EXISTS idx_treatment_goals_order ON public.treatment_goals(program_id, order_index);

CREATE INDEX IF NOT EXISTS idx_treatment_session_plans_program ON public.treatment_session_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_treatment_session_plans_order
    ON public.treatment_session_plans(program_id, session_number);
