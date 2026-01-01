# file: therapist_service.py
"""
Therapist Dashboard Service
Quản lý NTL, thân chủ, bài tập và báo cáo.
"""

import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


class TherapistService:
    """Service cho Therapist Dashboard"""
    
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL và SUPABASE_KEY cần được thiết lập")
        self.supabase: Client = create_client(url, key)
        print("✅ TherapistService initialized")
    
    # === THERAPIST CRUD ===
    
    def get_therapist(self, therapist_id: str) -> Optional[Dict]:
        """Lấy thông tin NTL theo ID"""
        response = self.supabase.table('therapists').select('*').eq('id', therapist_id).execute()
        return response.data[0] if response.data else None
    
    def get_therapist_by_email(self, email: str) -> Optional[Dict]:
        """Lấy NTL theo email"""
        response = self.supabase.table('therapists').select('*').eq('email', email).execute()
        return response.data[0] if response.data else None
    
    def create_therapist(self, email: str, name: str, license_number: str = None) -> Dict:
        """Tạo NTL mới"""
        data = {
            'email': email,
            'name': name,
            'license_number': license_number,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapists').insert(data).execute()
        return response.data[0]
    
    # === CLIENT PAIRING ===
    
    def get_my_clients(self, therapist_id: str) -> List[Dict]:
        """Lấy danh sách thân chủ của NTL"""
        response = self.supabase.table('therapist_clients')\
            .select('*, users!inner(id, name, email)')\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data
    
    def pair_client(self, therapist_id: str, client_id: str, pairing_code: str = None) -> Dict:
        """Ghép cặp NTL với thân chủ"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'paired_at': datetime.now(timezone.utc).isoformat(),
            'status': 'active'
        }
        response = self.supabase.table('therapist_clients').insert(data).execute()
        return response.data[0] if response.data else None
    
    def unpair_client(self, therapist_id: str, client_id: str) -> bool:
        """Hủy ghép cặp"""
        self.supabase.table('therapist_clients')\
            .update({'status': 'inactive'})\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .execute()
        return True
    
    def get_client_therapist(self, client_id: str) -> Optional[Dict]:
        """Lấy NTL của một thân chủ"""
        response = self.supabase.table('therapist_clients')\
            .select('*, therapists!inner(*)')\
            .eq('client_id', client_id)\
            .eq('status', 'active')\
            .execute()
        return response.data[0] if response.data else None
    
    # === ASSIGNMENTS (Bài tập) ===
    
    def create_assignment(
        self, 
        therapist_id: str, 
        client_id: str, 
        title: str, 
        description: str,
        due_date: str = None
    ) -> Dict:
        """NTL giao bài tập cho thân chủ"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'title': title,
            'description': description,
            'due_date': due_date,
            'status': 'pending',
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('assignments').insert(data).execute()
        return response.data[0] if response.data else None
    
    def get_client_assignments(self, client_id: str, status: str = None) -> List[Dict]:
        """Lấy bài tập của thân chủ"""
        query = self.supabase.table('assignments')\
            .select('*')\
            .eq('client_id', client_id)
        if status:
            query = query.eq('status', status)
        response = query.order('created_at', desc=True).execute()
        return response.data
    
    def get_therapist_assignments(self, therapist_id: str) -> List[Dict]:
        """Lấy tất cả bài tập NTL đã giao"""
        response = self.supabase.table('assignments')\
            .select('*, users!client_id(id, name)')\
            .eq('therapist_id', therapist_id)\
            .order('created_at', desc=True)\
            .execute()
        return response.data
    
    def complete_assignment(self, assignment_id: int, completion_notes: str = None) -> Dict:
        """Thân chủ đánh dấu hoàn thành bài tập"""
        data = {
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'completion_notes': completion_notes
        }
        response = self.supabase.table('assignments')\
            .update(data)\
            .eq('id', assignment_id)\
            .execute()
        return response.data[0] if response.data else None
    
    # === CRISIS ALERTS ===
    
    def log_crisis_event(
        self, 
        client_id: str, 
        crisis_level: str, 
        message_snippet: str
    ) -> Dict:
        """Lưu sự kiện khủng hoảng và thông báo NTL"""
        # Get client's therapist
        pairing = self.get_client_therapist(client_id)
        therapist_id = pairing['therapist_id'] if pairing else None
        
        data = {
            'client_id': client_id,
            'therapist_id': therapist_id,
            'crisis_level': crisis_level,
            'message_snippet': message_snippet[:200],  # Truncate
            'created_at': datetime.now(timezone.utc).isoformat(),
            'acknowledged': False
        }
        response = self.supabase.table('crisis_events').insert(data).execute()
        
        # TODO: Send real notification (email, push, etc.)
        if therapist_id:
            print(f"🚨 [ALERT] Crisis event logged for therapist {therapist_id}")
        
        return response.data[0] if response.data else None
    
    def get_unacknowledged_crises(self, therapist_id: str) -> List[Dict]:
        """Lấy các crisis chưa acknowledged của NTL"""
        response = self.supabase.table('crisis_events')\
            .select('*, users!client_id(id, name)')\
            .eq('therapist_id', therapist_id)\
            .eq('acknowledged', False)\
            .order('created_at', desc=True)\
            .execute()
        return response.data
    
    def acknowledge_crisis(self, crisis_id: int, notes: str = None) -> Dict:
        """NTL xác nhận đã xem crisis"""
        data = {
            'acknowledged': True,
            'acknowledged_at': datetime.now(timezone.utc).isoformat(),
            'therapist_notes': notes
        }
        response = self.supabase.table('crisis_events')\
            .update(data)\
            .eq('id', crisis_id)\
            .execute()
        return response.data[0] if response.data else None
    
    # === CLIENT PROGRESS ===
    
    def get_client_summary(self, client_id: str) -> Dict:
        """Lấy tóm tắt tiến độ của thân chủ cho dashboard"""
        # Total sessions
        sessions = self.supabase.table('chat_sessions')\
            .select('id', count='exact')\
            .eq('user_id', client_id)\
            .execute()
        
        # Completed assignments
        completed = self.supabase.table('assignments')\
            .select('id', count='exact')\
            .eq('client_id', client_id)\
            .eq('status', 'completed')\
            .execute()
        
        # Pending assignments
        pending = self.supabase.table('assignments')\
            .select('id', count='exact')\
            .eq('client_id', client_id)\
            .eq('status', 'pending')\
            .execute()
        
        # Crisis count
        crises = self.supabase.table('crisis_events')\
            .select('id', count='exact')\
            .eq('client_id', client_id)\
            .execute()
        
        return {
            'total_sessions': sessions.count if sessions.count else 0,
            'completed_assignments': completed.count if completed.count else 0,
            'pending_assignments': pending.count if pending.count else 0,
            'crisis_events': crises.count if crises.count else 0
        }


# Singleton
_service_instance = None

def get_therapist_service() -> TherapistService:
    global _service_instance
    if _service_instance is None:
        _service_instance = TherapistService()
    return _service_instance


# === SQL to create tables ===
SQL_CREATE_TABLES = """
-- Therapists table
CREATE TABLE IF NOT EXISTS therapists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    license_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Therapist-Client pairing
CREATE TABLE IF NOT EXISTS therapist_clients (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    client_id TEXT REFERENCES users(id),
    paired_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    UNIQUE(therapist_id, client_id)
);

-- Assignments (Homework)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    client_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending',
    completion_notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Crisis Events
CREATE TABLE IF NOT EXISTS crisis_events (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    crisis_level TEXT NOT NULL,
    message_snippet TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    therapist_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies (optional, for security)
ALTER TABLE therapist_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE crisis_events ENABLE ROW LEVEL SECURITY;
"""

if __name__ == "__main__":
    print("=== SQL để tạo bảng trong Supabase ===")
    print(SQL_CREATE_TABLES)
