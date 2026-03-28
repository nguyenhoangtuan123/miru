-- Email OTP challenge table for passwordless login
CREATE TABLE IF NOT EXISTS auth_email_otps (
    id              bigint generated always as identity primary key,
    email           text not null,
    code_hash       text not null,
    intent          text not null default 'client',
    surface         text not null default 'app',
    return_to       text not null default '/chat',
    entry           text not null default '',
    anonymous_id    text,
    session_id      text,
    expires_at      timestamptz not null,
    consumed_at     timestamptz,
    attempt_count   int not null default 0,
    created_at      timestamptz not null default now()
);

-- Fast lookup for active (unconsumed) OTPs by email
CREATE INDEX IF NOT EXISTS idx_email_otps_email_active
    ON auth_email_otps (email, expires_at)
    WHERE consumed_at IS NULL;
