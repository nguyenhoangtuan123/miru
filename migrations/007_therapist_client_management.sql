-- =============================================
-- Migration: Therapist Client Management Features
-- Bổ sung các bảng cho quản lý thân chủ nâng cao
-- =============================================

-- 1. Extended User Profile
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth DATE,
    gender TEXT,
    phone TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 2. User Privacy Settings
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    allow_therapist_chat_history BOOLEAN DEFAULT FALSE,
    allow_therapist_mood_journal BOOLEAN DEFAULT FALSE,
    allow_therapist_assignments BOOLEAN DEFAULT TRUE,
    allow_therapist_goals BOOLEAN DEFAULT FALSE,
    allow_therapist_memories BOOLEAN DEFAULT FALSE,
    share_history_days INTEGER DEFAULT 30,
    notify_when_therapist_access BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Medical Profile (encrypted fields should be handled at application level)
CREATE TABLE IF NOT EXISTS client_medical_profiles (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    -- Thông tin điều trị
    presenting_problem TEXT,
    psychiatric_history TEXT,
    current_medications TEXT,
    allergies TEXT,
    dsm5_codes TEXT[],
    
    -- Mục tiêu điều trị
    treatment_goals TEXT,
    treatment_plan TEXT,
    estimated_sessions INTEGER,
    
    -- Thông tin khẩn cấp
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(client_id, therapist_id)
);

CREATE INDEX IF NOT EXISTS idx_medical_profiles_client ON client_medical_profiles(client_id);
CREATE INDEX IF NOT EXISTS idx_medical_profiles_therapist ON client_medical_profiles(therapist_id);

-- 4. Session Notes
CREATE TABLE IF NOT EXISTS therapist_session_notes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    session_date TIMESTAMPTZ NOT NULL,
    session_type TEXT DEFAULT 'online',
    duration_minutes INTEGER,
    
    session_content TEXT,
    client_presentation TEXT,
    interventions_used TEXT[],
    
    progress_assessment TEXT,
    mood_observation TEXT,
    risk_assessment TEXT,
    
    next_session_plan TEXT,
    homework_assigned TEXT,
    private_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_notes_client ON therapist_session_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_therapist ON therapist_session_notes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_session_notes_date ON therapist_session_notes(session_date);

-- 5. Direct Messages
CREATE TABLE IF NOT EXISTS therapist_client_messages (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    sender_type TEXT NOT NULL CHECK (sender_type IN ('therapist', 'client')),
    message_content TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_client_therapist ON therapist_client_messages(client_id, therapist_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON therapist_client_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON therapist_client_messages(therapist_id, is_read) WHERE is_read = FALSE;

-- 6. Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    
    type TEXT DEFAULT 'online' CHECK (type IN ('online', 'offline', 'phone')),
    location TEXT,
    meeting_link TEXT,
    
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    
    client_confirmed BOOLEAN DEFAULT FALSE,
    therapist_confirmed BOOLEAN DEFAULT TRUE,
    
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,
    
    notes TEXT,
    cancellation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_therapist ON appointments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 7. Progress Metrics
CREATE TABLE IF NOT EXISTS client_progress_metrics (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    week_number INTEGER,
    year INTEGER,
    
    app_usage_days INTEGER,
    total_chat_sessions INTEGER,
    avg_emotion_score DECIMAL(3,1),
    journal_entries_count INTEGER,
    
    assignments_completed INTEGER,
    assignments_total INTEGER,
    appointments_attended INTEGER,
    appointments_total INTEGER,
    
    therapist_assessment TEXT,
    progress_rating INTEGER CHECK (progress_rating BETWEEN 1 AND 10),
    
    phq9_score INTEGER,
    gad7_score INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_client ON client_progress_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_progress_therapist ON client_progress_metrics(therapist_id);
CREATE INDEX IF NOT EXISTS idx_progress_week ON client_progress_metrics(year, week_number);

-- 8. Client Groups
CREATE TABLE IF NOT EXISTS therapist_client_groups (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_therapist ON therapist_client_groups(therapist_id);

-- 9. Client Group Members
CREATE TABLE IF NOT EXISTS therapist_client_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES therapist_client_groups(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON therapist_client_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_client ON therapist_client_group_members(client_id);

-- 10. Treatment Outcomes
CREATE TABLE IF NOT EXISTS treatment_outcomes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    closure_date DATE,
    closure_reason TEXT CHECK (closure_reason IN ('completed', 'referred', 'dropped_out', 'moved', 'other')),
    
    outcome_rating TEXT CHECK (outcome_rating IN ('significantly_improved', 'improved', 'stable', 'worsened')),
    
    goals_total INTEGER,
    goals_achieved INTEGER,
    
    client_feedback TEXT,
    therapist_notes TEXT,
    lessons_learned TEXT,
    
    follow_up_recommended BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_client ON treatment_outcomes(client_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_therapist ON treatment_outcomes(therapist_id);

-- 11. Audit Log
CREATE TABLE IF NOT EXISTS data_access_audit (
    id SERIAL PRIMARY KEY,
    
    accessor_id TEXT NOT NULL,
    accessor_type TEXT NOT NULL CHECK (accessor_type IN ('therapist', 'admin', 'system')),
    
    client_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL CHECK (action IN ('view', 'edit', 'delete', 'export')),
    resource_type TEXT NOT NULL,
    resource_id INTEGER,
    
    ip_address INET,
    user_agent TEXT,
    
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_client ON data_access_audit(client_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_audit_accessor ON data_access_audit(accessor_id, accessed_at);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON data_access_audit(resource_type, resource_id);

-- 12. Privacy Consent Log
CREATE TABLE IF NOT EXISTS privacy_consent_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    
    consent_type TEXT NOT NULL,
    consent_given BOOLEAN NOT NULL,
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON privacy_consent_log(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_therapist ON privacy_consent_log(therapist_id);

-- =============================================
-- RLS Policies
-- =============================================

-- Enable RLS on all new tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_privacy_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_medical_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_session_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_progress_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_client_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_client_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_access_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_consent_log ENABLE ROW LEVEL SECURITY;

-- Note: Actual RLS policies should be created based on your auth setup
-- Example policies (customize as needed):

-- Medical profiles: Only assigned therapist can access
-- CREATE POLICY "Therapist can access own client medical profiles"
--     ON client_medical_profiles
--     FOR ALL
--     USING (therapist_id = current_setting('app.current_therapist_id')::UUID);

-- Session notes: Only assigned therapist can access
-- CREATE POLICY "Therapist can access own session notes"
--     ON therapist_session_notes
--     FOR ALL
--     USING (therapist_id = current_setting('app.current_therapist_id')::UUID);

-- =============================================
-- Grants
-- =============================================

GRANT ALL ON user_profiles TO anon, authenticated, service_role;
GRANT ALL ON user_privacy_settings TO anon, authenticated, service_role;
GRANT ALL ON client_medical_profiles TO anon, authenticated, service_role;
GRANT ALL ON therapist_session_notes TO anon, authenticated, service_role;
GRANT ALL ON therapist_client_messages TO anon, authenticated, service_role;
GRANT ALL ON appointments TO anon, authenticated, service_role;
GRANT ALL ON client_progress_metrics TO anon, authenticated, service_role;
GRANT ALL ON therapist_client_groups TO anon, authenticated, service_role;
GRANT ALL ON therapist_client_group_members TO anon, authenticated, service_role;
GRANT ALL ON treatment_outcomes TO anon, authenticated, service_role;
GRANT ALL ON data_access_audit TO anon, authenticated, service_role;
GRANT ALL ON privacy_consent_log TO anon, authenticated, service_role;

-- Sequences
GRANT USAGE, SELECT ON SEQUENCE client_medical_profiles_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE therapist_session_notes_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE therapist_client_messages_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE appointments_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE client_progress_metrics_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE therapist_client_groups_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE therapist_client_group_members_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE treatment_outcomes_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE data_access_audit_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE privacy_consent_log_id_seq TO anon, authenticated, service_role;
