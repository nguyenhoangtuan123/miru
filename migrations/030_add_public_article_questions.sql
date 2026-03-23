BEGIN;

CREATE TABLE IF NOT EXISTS public.public_article_questions (
    question_id TEXT PRIMARY KEY,
    article_slug TEXT NOT NULL,
    therapist_id TEXT NOT NULL,
    user_id TEXT,
    anonymous_id TEXT,
    public_display_name TEXT NOT NULL DEFAULT 'Nguoi dung Miru',
    question_text TEXT NOT NULL,
    answer_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending_review',
    questioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    answered_at TIMESTAMPTZ,
    hidden_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_article_questions_article
    ON public.public_article_questions(article_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_questions_therapist
    ON public.public_article_questions(therapist_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_questions_user
    ON public.public_article_questions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_questions_anonymous
    ON public.public_article_questions(anonymous_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_questions_status
    ON public.public_article_questions(status, updated_at DESC);

COMMIT;
