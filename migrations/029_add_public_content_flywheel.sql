BEGIN;

CREATE TABLE IF NOT EXISTS public.public_content_events (
    id BIGSERIAL PRIMARY KEY,
    anonymous_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    user_id TEXT,
    event_type TEXT NOT NULL,
    article_slug TEXT,
    therapist_id TEXT,
    topic_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    read_depth_percent INTEGER,
    referrer TEXT,
    source_path TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_content_events_anonymous
    ON public.public_content_events(anonymous_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_content_events_user
    ON public.public_content_events(user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_content_events_article
    ON public.public_content_events(article_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_content_events_therapist
    ON public.public_content_events(therapist_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_content_events_type
    ON public.public_content_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.public_content_identity_links (
    id BIGSERIAL PRIMARY KEY,
    anonymous_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    latest_session_id TEXT,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_content_identity_links_user
    ON public.public_content_identity_links(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.public_article_ai_sessions (
    session_id TEXT PRIMARY KEY,
    anonymous_id TEXT NOT NULL,
    user_id TEXT,
    article_slug TEXT NOT NULL,
    quota_scope TEXT NOT NULL DEFAULT 'anonymous_monthly',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_sessions_anonymous
    ON public.public_article_ai_sessions(anonymous_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_sessions_user
    ON public.public_article_ai_sessions(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_sessions_article
    ON public.public_article_ai_sessions(article_slug, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.public_article_ai_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    anonymous_id TEXT NOT NULL,
    user_id TEXT,
    article_slug TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_messages_session
    ON public.public_article_ai_messages(session_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_messages_user
    ON public.public_article_ai_messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_article_ai_messages_anonymous
    ON public.public_article_ai_messages(anonymous_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_feature_entitlements (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    feature_key TEXT NOT NULL,
    monthly_quota INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feature_entitlements_lookup
    ON public.user_feature_entitlements(user_id, feature_key, is_active);

ALTER TABLE IF EXISTS public.therapist_contact_requests
    ADD COLUMN IF NOT EXISTS source_article_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_therapist_contact_requests_source_article
    ON public.therapist_contact_requests(source, source_article_slug, created_at DESC);

COMMIT;
