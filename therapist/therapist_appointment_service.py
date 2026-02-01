"""
Therapist Appointment Service
Quản lý lịch hẹn trị liệu
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional


class TherapistAppointmentService:
    """Service cho lịch hẹn trị liệu"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
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
        now = datetime.now(timezone.utc)
        future = now + timedelta(days=days)
        return self.get_appointments(
            therapist_id,
            from_date=now.isoformat(),
            to_date=future.isoformat()
        )