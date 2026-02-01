"""
Therapist Medical Service
Quản lý hồ sơ y khoa và ghi chú phiên trị liệu
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


class TherapistMedicalService:
    """Service cho hồ sơ y khoa và session notes"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    # === MEDICAL PROFILE ===
    
    def get_medical_profile(self, therapist_id: str, client_id: str) -> Optional[Dict]:
        """Lấy hồ sơ y khoa của thân chủ"""
        response = self.supabase.table('client_medical_profiles')\
            .select('*')\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def create_or_update_medical_profile(
        self,
        therapist_id: str,
        client_id: str,
        presenting_problem: str = None,
        psychiatric_history: str = None,
        current_medications: str = None,
        allergies: str = None,
        dsm5_codes: List[str] = None,
        treatment_goals: str = None,
        treatment_plan: str = None,
        estimated_sessions: int = None,
        emergency_contact_name: str = None,
        emergency_contact_phone: str = None,
        emergency_contact_relationship: str = None
    ) -> Dict:
        """Tạo hoặc cập nhật hồ sơ y khoa"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'presenting_problem': presenting_problem,
            'psychiatric_history': psychiatric_history,
            'current_medications': current_medications,
            'allergies': allergies,
            'dsm5_codes': dsm5_codes or [],
            'treatment_goals': treatment_goals,
            'treatment_plan': treatment_plan,
            'estimated_sessions': estimated_sessions,
            'emergency_contact_name': emergency_contact_name,
            'emergency_contact_phone': emergency_contact_phone,
            'emergency_contact_relationship': emergency_contact_relationship,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Check if exists
        existing = self.get_medical_profile(therapist_id, client_id)
        if existing:
            response = self.supabase.table('client_medical_profiles')\
                .update(data)\
                .eq('id', existing['id'])\
                .execute()
        else:
            data['created_at'] = datetime.now(timezone.utc).isoformat()
            response = self.supabase.table('client_medical_profiles')\
                .insert(data)\
                .execute()
        
        return response.data[0] if response.data else None
    
    # === SESSION NOTES ===
    
    def get_session_notes(self, therapist_id: str, client_id: str, limit: int = 50) -> List[Dict]:
        """Lấy ghi chú phiên trị liệu"""
        response = self.supabase.table('therapist_session_notes')\
            .select('*')\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .order('session_date', desc=True)\
            .limit(limit)\
            .execute()
        return response.data
    
    def get_session_note(self, note_id: int, therapist_id: str) -> Optional[Dict]:
        """Lấy một ghi chú cụ thể"""
        response = self.supabase.table('therapist_session_notes')\
            .select('*')\
            .eq('id', note_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def create_session_note(
        self,
        therapist_id: str,
        client_id: str,
        session_date: str,
        session_type: str = 'online',
        duration_minutes: int = None,
        session_content: str = None,
        client_presentation: str = None,
        interventions_used: List[str] = None,
        progress_assessment: str = None,
        mood_observation: str = None,
        risk_assessment: str = None,
        next_session_plan: str = None,
        homework_assigned: str = None,
        private_notes: str = None
    ) -> Dict:
        """Tạo ghi chú phiên trị liệu mới"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'session_date': session_date,
            'session_type': session_type,
            'duration_minutes': duration_minutes,
            'session_content': session_content,
            'client_presentation': client_presentation,
            'interventions_used': interventions_used or [],
            'progress_assessment': progress_assessment,
            'mood_observation': mood_observation,
            'risk_assessment': risk_assessment,
            'next_session_plan': next_session_plan,
            'homework_assigned': homework_assigned,
            'private_notes': private_notes,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapist_session_notes')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def update_session_note(self, note_id: int, therapist_id: str, updates: Dict) -> Optional[Dict]:
        """Cập nhật ghi chú phiên trị liệu"""
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()
        response = self.supabase.table('therapist_session_notes')\
            .update(updates)\
            .eq('id', note_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def delete_session_note(self, note_id: int, therapist_id: str) -> bool:
        """Xóa ghi chú phiên trị liệu"""
        self.supabase.table('therapist_session_notes')\
            .delete()\
            .eq('id', note_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return True