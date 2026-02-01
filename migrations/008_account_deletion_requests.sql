-- =============================================
-- Migration: Account Deletion Requests Table
-- Bổ sung bảng cho yêu cầu xóa tài khoản (GDPR)
-- =============================================

-- Account Deletion Requests Table
CREATE TABLE IF NOT EXISTS account_deletion_requests (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'completed', 'expired')),
    
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    scheduled_deletion_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user ON account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON account_deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_scheduled ON account_deletion_requests(scheduled_deletion_at);

-- Enable RLS
ALTER TABLE account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON account_deletion_requests TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE account_deletion_requests_id_seq TO anon, authenticated, service_role;
