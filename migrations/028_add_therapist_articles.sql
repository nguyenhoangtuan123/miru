BEGIN;

DO $$
DECLARE
    therapist_id_type TEXT := 'uuid';
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'therapist_articles'
    )
    INTO table_exists;

    SELECT COALESCE(
        NULLIF(pg_catalog.format_type(a.atttypid, a.atttypmod), ''),
        'uuid'
    )
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

    therapist_id_type := COALESCE(NULLIF(TRIM(therapist_id_type), ''), 'uuid');

    IF NOT table_exists THEN
        EXECUTE format(
            'CREATE TABLE public.therapist_articles (
                id BIGSERIAL PRIMARY KEY,
                therapist_id %1$s NOT NULL REFERENCES public.therapists(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                excerpt TEXT NOT NULL DEFAULT '''',
                cover_image_url TEXT,
                content_markdown TEXT NOT NULL DEFAULT '''',
                status TEXT NOT NULL DEFAULT ''draft'',
                seo_title TEXT,
                seo_description TEXT,
                review_requested_at TIMESTAMPTZ,
                reviewed_at TIMESTAMPTZ,
                reviewed_by_email TEXT,
                rejection_reason TEXT,
                published_at TIMESTAMPTZ,
                archived_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )',
            therapist_id_type
        );
    ELSE
        EXECUTE format('ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS therapist_id %s', therapist_id_type);
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS title TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS slug TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS excerpt TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS cover_image_url TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS content_markdown TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS status TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS seo_title TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS seo_description TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS review_requested_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS rejection_reason TEXT';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE public.therapist_articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ';

        EXECUTE 'ALTER TABLE public.therapist_articles ALTER COLUMN excerpt SET DEFAULT ''''''';
        EXECUTE 'ALTER TABLE public.therapist_articles ALTER COLUMN content_markdown SET DEFAULT ''''''';
        EXECUTE 'ALTER TABLE public.therapist_articles ALTER COLUMN status SET DEFAULT ''draft''';
        EXECUTE 'ALTER TABLE public.therapist_articles ALTER COLUMN created_at SET DEFAULT NOW()';
        EXECUTE 'ALTER TABLE public.therapist_articles ALTER COLUMN updated_at SET DEFAULT NOW()';
    END IF;
END $$;

UPDATE public.therapist_articles
SET
    status = COALESCE(NULLIF(status, ''), 'draft'),
    excerpt = COALESCE(excerpt, ''),
    content_markdown = COALESCE(content_markdown, ''),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE TRUE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_articles_status_check'
    ) THEN
        ALTER TABLE public.therapist_articles
            ADD CONSTRAINT therapist_articles_status_check
            CHECK (status IN ('draft', 'pending_review', 'published', 'rejected', 'archived'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'therapist_articles_therapist_id_fkey'
    ) THEN
        ALTER TABLE public.therapist_articles
            ADD CONSTRAINT therapist_articles_therapist_id_fkey
            FOREIGN KEY (therapist_id) REFERENCES public.therapists(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_therapist_articles_slug
    ON public.therapist_articles(slug);

CREATE INDEX IF NOT EXISTS idx_therapist_articles_status
    ON public.therapist_articles(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_therapist_articles_therapist
    ON public.therapist_articles(therapist_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_therapist_articles_review_requested_at
    ON public.therapist_articles(review_requested_at DESC);

COMMIT;
