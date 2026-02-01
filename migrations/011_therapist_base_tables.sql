-- =============================================
-- Migration: Therapist Base Tables
-- Creates the core therapist tables that were missing
-- Run this BEFORE migration 007
-- =============================================

-- 1. Therapists Table (base table for all therapist features)
CREATE TABLE IF NOT EXISTS therapists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,  -- Link to user account if exists
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    license_number TEXT,
    specializations TEXT[],
    bio TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_therapists_user_id ON therapists(user_id);
CREATE INDEX IF NOT EXISTS idx_therapists_email ON therapists(email);
CREATE INDEX IF NOT EXISTS idx_therapists_active ON therapists(is_active);

-- 2. Therapist-Client Pairing Table (links therapists to their clients)
CREATE TABLE IF NOT EXISTS therapist_clients (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending', 'terminated')),
    pairing_code TEXT,
    notes TEXT,
    paired_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(therapist_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_therapist_clients_therapist ON therapist_clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_client ON therapist_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_status ON therapist_clients(status);
CREATE INDEX IF NOT EXISTS idx_therapist_clients_pairing_code ON therapist_clients(pairing_code);

-- 3. Assignments Table (therapist assigns tasks to clients)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'task' CHECK (type IN ('task', 'exercise', 'reading', 'journal', 'meditation', 'other')),
    due_date DATE,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
    completed_at TIMESTAMPTZ,
    client_feedback TEXT,
    therapist_notes TEXT,
    resources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_therapist ON assignments(therapist_id);
CREATE INDEX IF NOT EXISTS idx_assignments_client ON assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- 4. Crisis Events Table (tracking critical incidents)
CREATE TABLE IF NOT EXISTS crisis_events (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    trigger_source TEXT CHECK (trigger_source IN ('ai_detection', 'client_report', 'therapist_report', 'system')),
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'escalated')),
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crisis_events_client ON crisis_events(client_id);
CREATE INDEX IF NOT EXISTS idx_crisis_events_therapist ON crisis_events(therapist_id);
CREATE INDEX IF NOT EXISTS idx_crisis_events_severity ON crisis_events(severity);
CREATE INDEX IF NOT EXISTS idx_crisis_events_status ON crisis_events(status);
CREATE INDEX IF NOT EXISTS idx_crisis_events_detected ON crisis_events(detected_at DESC);

-- =============================================
-- Enable RLS
-- =============================================

ALTER TABLE therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE therapist_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_events ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS Policies (permissive for development, tighten in production)
-- =============================================

-- Therapists: Allow service role full access
CREATE POLICY "Service role full access to therapists" ON therapists
    FOR ALL USING (true);

-- Therapist Clients: Allow service role full access
CREATE POLICY "Service role full access to therapist_clients" ON therapist_clients
    FOR ALL USING (true);

-- Assignments: Allow service role full access
CREATE POLICY "Service role full access to assignments" ON assignments
    FOR ALL USING (true);

-- Crisis Events: Allow service role full access
CREATE POLICY "Service role full access to crisis_events" ON crisis_events
    FOR ALL USING (true);

-- =============================================
-- Grants
-- =============================================

GRANT ALL ON therapists TO anon, authenticated, service_role;
GRANT ALL ON therapist_clients TO anon, authenticated, service_role;
GRANT ALL ON assignments TO anon, authenticated, service_role;
GRANT ALL ON crisis_events TO anon, authenticated, service_role;

GRANT USAGE, SELECT ON SEQUENCE therapist_clients_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE assignments_id_seq TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE crisis_events_id_seq TO anon, authenticated, service_role;

-- =============================================
-- Helper function to create therapist from user
-- =============================================

CREATE OR REPLACE FUNCTION create_therapist_from_user(
    p_user_id TEXT,
    p_name TEXT DEFAULT NULL,
    p_license_number TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_therapist_id UUID;
    v_email TEXT;
    v_name TEXT;
BEGIN
    -- Get user email
    SELECT email, name INTO v_email, v_name FROM users WHERE id = p_user_id;
    
    IF v_email IS NULL THEN
        RAISE EXCEPTION 'User not found: %', p_user_id;
    END IF;
    
    -- Use provided name or user's name
    v_name := COALESCE(p_name, v_name, 'Therapist');
    
    -- Check if therapist already exists for this user
    SELECT id INTO v_therapist_id FROM therapists WHERE user_id = p_user_id;
    
    IF v_therapist_id IS NOT NULL THEN
        RETURN v_therapist_id;
    END IF;
    
    -- Create new therapist
    INSERT INTO therapists (user_id, email, name, license_number)
    VALUES (p_user_id, v_email, v_name, p_license_number)
    RETURNING id INTO v_therapist_id;
    
    RETURN v_therapist_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_therapist_from_user TO anon, authenticated, service_role;
