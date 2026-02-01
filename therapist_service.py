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


from therapist.therapist_medical_service import TherapistMedicalService
from therapist.therapist_messaging_service import TherapistMessagingService
from therapist.therapist_appointment_service import TherapistAppointmentService
from therapist.therapist_group_service import TherapistGroupService


class TherapistService:
    """Service cho Therapist Dashboard - Tổng hợp các module con"""
    
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL và SUPABASE_KEY cần được thiết lập")
        self.supabase: Client = create_client(url, key)
        
        # Khởi tạo các service con
        self.medical = TherapistMedicalService(self.supabase)
        self.messaging = TherapistMessagingService(self.supabase)
        self.appointment = TherapistAppointmentService(self.supabase)
        self.groups = TherapistGroupService(self.supabase)
        
        print("[OK] TherapistService initialized")
    
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
        sessions = self.supabase.table('chat_messages')\
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
    
    # === DIRECT MESSAGING ===
    
    def get_messages(self, therapist_id: str, client_id: str, limit: int = 50) -> List[Dict]:
        """Lấy tin nhắn giữa NTL và thân chủ"""
        response = self.supabase.table('therapist_client_messages')\
            .select('*')\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .order('created_at', desc=True)\
            .limit(limit)\
            .execute()
        return response.data
    
    def send_message(
        self,
        therapist_id: str,
        client_id: str,
        sender_type: str,
        message_content: str,
        attachments: List[Dict] = None
    ) -> Dict:
        """Gửi tin nhắn"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'sender_type': sender_type,
            'message_content': message_content,
            'attachments': attachments or [],
            'is_read': False,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapist_client_messages')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def mark_messages_as_read(self, therapist_id: str, client_id: str, sender_type: str) -> bool:
        """Đánh dấu tin nhắn đã đọc"""
        self.supabase.table('therapist_client_messages')\
            .update({
                'is_read': True,
                'read_at': datetime.now(timezone.utc).isoformat()
            })\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .eq('sender_type', sender_type)\
            .eq('is_read', False)\
            .execute()
        return True
    
    def get_unread_message_count(self, therapist_id: str, client_id: str = None) -> int:
        """Đếm số tin nhắn chưa đọc"""
        query = self.supabase.table('therapist_client_messages')\
            .select('id', count='exact')\
            .eq('therapist_id', therapist_id)\
            .eq('sender_type', 'client')\
            .eq('is_read', False)
        
        if client_id:
            query = query.eq('client_id', client_id)
        
        response = query.execute()
        return response.count if response.count else 0
    
    # === APPOINTMENTS ===
    
    def get_appointments(
        self,
        therapist_id: str,
        client_id: str = None,
        status: str = None,
        from_date: str = None,
        to_date: str = None
    ) -> List[Dict]:
        """Lấy danh sách lịch hẹn"""
        query = self.supabase.table('appointments')\
            .select('*, users!client_id(id, name, email)')\
            .eq('therapist_id', therapist_id)
        
        if client_id:
            query = query.eq('client_id', client_id)
        if status:
            query = query.eq('status', status)
        if from_date:
            query = query.gte('appointment_date', from_date)
        if to_date:
            query = query.lte('appointment_date', to_date)
        
        response = query.order('appointment_date', desc=True).execute()
        return response.data
    
    def get_appointment(self, appointment_id: int, therapist_id: str) -> Optional[Dict]:
        """Lấy chi tiết một lịch hẹn"""
        response = self.supabase.table('appointments')\
            .select('*, users!client_id(id, name, email)')\
            .eq('id', appointment_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def create_appointment(
        self,
        therapist_id: str,
        client_id: str,
        appointment_date: str,
        duration_minutes: int = 60,
        type: str = 'online',
        location: str = None,
        meeting_link: str = None,
        notes: str = None
    ) -> Dict:
        """Tạo lịch hẹn mới"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'appointment_date': appointment_date,
            'duration_minutes': duration_minutes,
            'type': type,
            'location': location,
            'meeting_link': meeting_link,
            'notes': notes,
            'status': 'scheduled',
            'therapist_confirmed': True,
            'client_confirmed': False,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('appointments')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def update_appointment(self, appointment_id: int, therapist_id: str, updates: Dict) -> Optional[Dict]:
        """Cập nhật lịch hẹn"""
        updates['updated_at'] = datetime.now(timezone.utc).isoformat()
        response = self.supabase.table('appointments')\
            .update(updates)\
            .eq('id', appointment_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def cancel_appointment(self, appointment_id: int, therapist_id: str, reason: str = None) -> bool:
        """Hủy lịch hẹn"""
        self.supabase.table('appointments')\
            .update({
                'status': 'cancelled',
                'cancellation_reason': reason,
                'updated_at': datetime.now(timezone.utc).isoformat()
            })\
            .eq('id', appointment_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return True
    
    def complete_appointment(self, appointment_id: int, therapist_id: str) -> bool:
        """Đánh dấu lịch hẹn đã hoàn thành"""
        self.supabase.table('appointments')\
            .update({
                'status': 'completed',
                'updated_at': datetime.now(timezone.utc).isoformat()
            })\
            .eq('id', appointment_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return True
    
    def get_today_appointments(self, therapist_id: str) -> List[Dict]:
        """Lấy lịch hẹn hôm nay"""
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        return self.get_appointments(therapist_id, from_date=today, to_date=today)
    
    def get_upcoming_appointments(self, therapist_id: str, days: int = 7) -> List[Dict]:
        """Lấy lịch hẹn sắp tới"""
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=days)
        return self.get_appointments(
            therapist_id,
            from_date=now.isoformat(),
            to_date=future.isoformat()
        )
    
    # === CLIENT GROUPS ===
    
    def get_client_groups(self, therapist_id: str) -> List[Dict]:
        """Lấy danh sách nhóm thân chủ"""
        response = self.supabase.table('therapist_client_groups')\
            .select('*, members:therapist_client_group_members(count)')\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data
    
    def get_client_group(self, group_id: int, therapist_id: str) -> Optional[Dict]:
        """Lấy chi tiết nhóm"""
        response = self.supabase.table('therapist_client_groups')\
            .select('*, members:therapist_client_group_members(*, user:users(id, name, email))')\
            .eq('id', group_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def create_client_group(self, therapist_id: str, name: str, description: str = None, color: str = None) -> Dict:
        """Tạo nhóm thân chủ mới"""
        data = {
            'therapist_id': therapist_id,
            'name': name,
            'description': description,
            'color': color,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapist_client_groups')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def update_client_group(self, group_id: int, therapist_id: str, updates: Dict) -> Optional[Dict]:
        """Cập nhật nhóm"""
        response = self.supabase.table('therapist_client_groups')\
            .update(updates)\
            .eq('id', group_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def delete_client_group(self, group_id: int, therapist_id: str) -> bool:
        """Xóa nhóm"""
        self.supabase.table('therapist_client_groups')\
            .delete()\
            .eq('id', group_id)\
            .eq('therapist_id', therapist_id)\
            .execute()
        return True
    
    def add_client_to_group(self, group_id: int, client_id: str, therapist_id: str) -> Dict:
        """Thêm thân chủ vào nhóm"""
        # Verify group belongs to therapist
        group = self.get_client_group(group_id, therapist_id)
        if not group:
            raise ValueError("Group not found or access denied")
        
        data = {
            'group_id': group_id,
            'client_id': client_id,
            'joined_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapist_client_group_members')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def remove_client_from_group(self, group_id: int, client_id: str, therapist_id: str) -> bool:
        """Xóa thân chủ khỏi nhóm"""
        self.supabase.table('therapist_client_group_members')\
            .delete()\
            .eq('group_id', group_id)\
            .eq('client_id', client_id)\
            .execute()
        return True
    
    # === PROGRESS METRICS ===
    
    def get_progress_metrics(self, therapist_id: str, client_id: str, limit: int = 10) -> List[Dict]:
        """Lấy chỉ số tiến độ"""
        response = self.supabase.table('client_progress_metrics')\
            .select('*')\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .order('year', desc=True)\
            .order('week_number', desc=True)\
            .limit(limit)\
            .execute()
        return response.data
    
    def create_progress_metric(
        self,
        therapist_id: str,
        client_id: str,
        week_number: int,
        year: int,
        app_usage_days: int = None,
        total_chat_sessions: int = None,
        avg_emotion_score: float = None,
        journal_entries_count: int = None,
        assignments_completed: int = None,
        assignments_total: int = None,
        appointments_attended: int = None,
        appointments_total: int = None,
        therapist_assessment: str = None,
        progress_rating: int = None,
        phq9_score: int = None,
        gad7_score: int = None
    ) -> Dict:
        """Tạo bản ghi tiến độ mới"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'week_number': week_number,
            'year': year,
            'app_usage_days': app_usage_days,
            'total_chat_sessions': total_chat_sessions,
            'avg_emotion_score': avg_emotion_score,
            'journal_entries_count': journal_entries_count,
            'assignments_completed': assignments_completed,
            'assignments_total': assignments_total,
            'appointments_attended': appointments_attended,
            'appointments_total': appointments_total,
            'therapist_assessment': therapist_assessment,
            'progress_rating': progress_rating,
            'phq9_score': phq9_score,
            'gad7_score': gad7_score,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('client_progress_metrics')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    # === TREATMENT OUTCOMES ===
    
    def get_treatment_outcome(self, therapist_id: str, client_id: str) -> Optional[Dict]:
        """Lấy kết quả điều trị"""
        response = self.supabase.table('treatment_outcomes')\
            .select('*')\
            .eq('therapist_id', therapist_id)\
            .eq('client_id', client_id)\
            .execute()
        return response.data[0] if response.data else None
    
    def create_or_update_treatment_outcome(
        self,
        therapist_id: str,
        client_id: str,
        closure_date: str = None,
        closure_reason: str = None,
        outcome_rating: str = None,
        goals_total: int = None,
        goals_achieved: int = None,
        client_feedback: str = None,
        therapist_notes: str = None,
        lessons_learned: str = None,
        follow_up_recommended: bool = False,
        follow_up_date: str = None
    ) -> Dict:
        """Tạo hoặc cập nhật kết quả điều trị"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'closure_date': closure_date,
            'closure_reason': closure_reason,
            'outcome_rating': outcome_rating,
            'goals_total': goals_total,
            'goals_achieved': goals_achieved,
            'client_feedback': client_feedback,
            'therapist_notes': therapist_notes,
            'lessons_learned': lessons_learned,
            'follow_up_recommended': follow_up_recommended,
            'follow_up_date': follow_up_date
        }
        
        existing = self.get_treatment_outcome(therapist_id, client_id)
        if existing:
            response = self.supabase.table('treatment_outcomes')\
                .update(data)\
                .eq('id', existing['id'])\
                .execute()
        else:
            data['created_at'] = datetime.now(timezone.utc).isoformat()
            response = self.supabase.table('treatment_outcomes')\
                .insert(data)\
                .execute()
        
        return response.data[0] if response.data else None
    
    # === AUDIT LOG ===
    
    def log_data_access(
        self,
        accessor_id: str,
        accessor_type: str,
        client_id: str,
        action: str,
        resource_type: str,
        resource_id: int = None,
        ip_address: str = None,
        user_agent: str = None
    ) -> Dict:
        """Ghi log truy cập dữ liệu"""
        data = {
            'accessor_id': accessor_id,
            'accessor_type': accessor_type,
            'client_id': client_id,
            'action': action,
            'resource_type': resource_type,
            'resource_id': resource_id,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'accessed_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('data_access_audit')\
            .insert(data)\
            .execute()
        return response.data[0] if response.data else None
    
    def get_audit_logs(
        self,
        therapist_id: str = None,
        client_id: str = None,
        from_date: str = None,
        to_date: str = None,
        limit: int = 100
    ) -> List[Dict]:
        """Lấy audit logs (cho admin)"""
        query = self.supabase.table('data_access_audit')\
            .select('*')\
            .order('accessed_at', desc=True)\
            .limit(limit)
        
        if therapist_id:
            query = query.eq('accessor_id', therapist_id)
        if client_id:
            query = query.eq('client_id', client_id)
        if from_date:
            query = query.gte('accessed_at', from_date)
        if to_date:
            query = query.lte('accessed_at', to_date)
        
        response = query.execute()
        return response.data
    
    # === BULK OPERATIONS ===
    
    def create_bulk_assignments(
        self,
        therapist_id: str,
        client_ids: List[str],
        title: str,
        description: str,
        due_date: str = None
    ) -> List[Dict]:
        """Giao bài tập cho nhiều thân chủ"""
        data = []
        for client_id in client_ids:
            data.append({
                'therapist_id': therapist_id,
                'client_id': client_id,
                'title': title,
                'description': description,
                'due_date': due_date,
                'status': 'pending',
                'created_at': datetime.now(timezone.utc).isoformat()
            })
        
        response = self.supabase.table('assignments')\
            .insert(data)\
            .execute()
        return response.data if response.data else []


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
