"""
Therapist Service - Main Entry Point
Consolidates all sub-services with security
"""

import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Import sub-services
from .therapist_medical_service import TherapistMedicalService
from .therapist_messaging_service import TherapistMessagingService
from .therapist_appointment_service import TherapistAppointmentService
from .therapist_group_service import TherapistGroupService
from .security import TherapistSecurity


class TherapistService:
    """
    Main Therapist Service
    Provides unified access to all therapist functionality with security
    """
    
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set")
        
        self.supabase: Client = create_client(url, key)
        
        # Initialize sub-services
        self.medical = TherapistMedicalService(self.supabase)
        self.messaging = TherapistMessagingService(self.supabase)
        self.appointment = TherapistAppointmentService(self.supabase)
        self.groups = TherapistGroupService(self.supabase)
        self.security = TherapistSecurity(self.supabase)
        
        print("[OK] TherapistService initialized with security")
    
    # === THERAPIST CRUD ===
    
    def get_therapist(self, therapist_id: str) -> Optional[Dict]:
        """Get therapist by ID"""
        response = self.supabase.table('therapists').select('*').eq('id', therapist_id).execute()
        return response.data[0] if response.data else None
    
    def get_therapist_by_email(self, email: str) -> Optional[Dict]:
        """Get therapist by email"""
        response = self.supabase.table('therapists').select('*').eq('email', email).execute()
        return response.data[0] if response.data else None
    
    def create_therapist(self, email: str, name: str, license_number: str = None) -> Dict:
        """Create new therapist"""
        data = {
            'email': email,
            'name': name,
            'license_number': license_number,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        response = self.supabase.table('therapists').insert(data).execute()
        return response.data[0] if response.data else None
    
    # === CLIENT PAIRING (with security) ===
    
    def get_my_clients(self, therapist_id: str) -> List[Dict]:
        """Get therapist's clients"""
        response = self.supabase.table('therapist_clients') \
            .select('*, users!inner(id, name, email)') \
            .eq('therapist_id', therapist_id) \
            .eq('status', 'active') \
            .execute()
        return response.data or []
    
    def pair_client(self, therapist_id: str, client_id: str, pairing_code: str = None) -> Optional[Dict]:
        """Pair therapist with client"""
        # Check if already paired
        existing = self.supabase.table('therapist_clients') \
            .select('id') \
            .eq('therapist_id', therapist_id) \
            .eq('client_id', client_id) \
            .execute()
        
        if existing.data:
            # Reactivate if inactive
            self.supabase.table('therapist_clients') \
                .update({'status': 'active', 'paired_at': datetime.now(timezone.utc).isoformat()}) \
                .eq('therapist_id', therapist_id) \
                .eq('client_id', client_id) \
                .execute()
            return existing.data[0]
        
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'paired_at': datetime.now(timezone.utc).isoformat(),
            'status': 'active'
        }
        response = self.supabase.table('therapist_clients').insert(data).execute()
        return response.data[0] if response.data else None
    
    def unpair_client(self, therapist_id: str, client_id: str) -> bool:
        """Unpair client (soft delete)"""
        self.supabase.table('therapist_clients') \
            .update({'status': 'inactive'}) \
            .eq('therapist_id', therapist_id) \
            .eq('client_id', client_id) \
            .execute()
        return True
    
    def get_client_therapist(self, client_id: str) -> Optional[Dict]:
        """Get client's active therapist"""
        response = self.supabase.table('therapist_clients') \
            .select('*, therapists!inner(*)') \
            .eq('client_id', client_id) \
            .eq('status', 'active') \
            .execute()
        return response.data[0] if response.data else None
    
    # === ASSIGNMENTS ===
    
    def create_assignment(
        self, 
        therapist_id: str, 
        client_id: str, 
        title: str, 
        description: str,
        due_date: str = None
    ) -> Optional[Dict]:
        """Create assignment for client"""
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
        """Get client's assignments"""
        query = self.supabase.table('assignments').select('*').eq('client_id', client_id)
        if status:
            query = query.eq('status', status)
        response = query.order('created_at', desc=True).execute()
        return response.data or []
    
    def get_therapist_assignments(self, therapist_id: str) -> List[Dict]:
        """Get all assignments created by therapist"""
        response = self.supabase.table('assignments') \
            .select('*, users!client_id(id, name)') \
            .eq('therapist_id', therapist_id) \
            .order('created_at', desc=True) \
            .execute()
        return response.data or []
    
    def complete_assignment(self, assignment_id: int, completion_notes: str = None) -> Optional[Dict]:
        """Mark assignment as completed"""
        data = {
            'status': 'completed',
            'completed_at': datetime.now(timezone.utc).isoformat(),
            'completion_notes': completion_notes
        }
        response = self.supabase.table('assignments') \
            .update(data) \
            .eq('id', assignment_id) \
            .execute()
        return response.data[0] if response.data else None
    
    def create_bulk_assignments(
        self,
        therapist_id: str,
        client_ids: List[str],
        title: str,
        description: str,
        due_date: str = None
    ) -> List[Dict]:
        """Create same assignment for multiple clients"""
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
        
        response = self.supabase.table('assignments').insert(data).execute()
        return response.data or []
    
    # === CRISIS EVENTS ===
    
    def log_crisis_event(
        self, 
        client_id: str, 
        crisis_level: str, 
        message_snippet: str
    ) -> Optional[Dict]:
        """Log crisis event and notify therapist"""
        pairing = self.get_client_therapist(client_id)
        therapist_id = pairing['therapist_id'] if pairing else None
        
        data = {
            'client_id': client_id,
            'therapist_id': therapist_id,
            'crisis_level': crisis_level,
            'message_snippet': message_snippet[:200],
            'created_at': datetime.now(timezone.utc).isoformat(),
            'acknowledged': False
        }
        response = self.supabase.table('crisis_events').insert(data).execute()
        
        if therapist_id:
            print(f"🚨 [ALERT] Crisis event for therapist {therapist_id}")
            # TODO: Send push notification / email
        
        return response.data[0] if response.data else None
    
    def get_unacknowledged_crises(self, therapist_id: str) -> List[Dict]:
        """Get unacknowledged crises for therapist"""
        response = self.supabase.table('crisis_events') \
            .select('*, users!client_id(id, name)') \
            .eq('therapist_id', therapist_id) \
            .eq('acknowledged', False) \
            .order('created_at', desc=True) \
            .execute()
        return response.data or []
    
    def acknowledge_crisis(self, crisis_id: int, notes: str = None) -> Optional[Dict]:
        """Acknowledge crisis event"""
        data = {
            'acknowledged': True,
            'acknowledged_at': datetime.now(timezone.utc).isoformat(),
            'therapist_notes': notes
        }
        response = self.supabase.table('crisis_events') \
            .update(data) \
            .eq('id', crisis_id) \
            .execute()
        return response.data[0] if response.data else None
    
    # === CLIENT PROGRESS SUMMARY ===
    
    def get_client_summary(self, client_id: str) -> Dict:
        """Get client progress summary for dashboard"""
        # Total chat sessions
        sessions = self.supabase.table('chat_messages') \
            .select('id', count='exact') \
            .eq('user_id', client_id) \
            .execute()
        
        # Completed assignments
        completed = self.supabase.table('assignments') \
            .select('id', count='exact') \
            .eq('client_id', client_id) \
            .eq('status', 'completed') \
            .execute()
        
        # Pending assignments
        pending = self.supabase.table('assignments') \
            .select('id', count='exact') \
            .eq('client_id', client_id) \
            .eq('status', 'pending') \
            .execute()
        
        # Crisis count
        crises = self.supabase.table('crisis_events') \
            .select('id', count='exact') \
            .eq('client_id', client_id) \
            .execute()
        
        return {
            'total_sessions': sessions.count or 0,
            'completed_assignments': completed.count or 0,
            'pending_assignments': pending.count or 0,
            'crisis_events': crises.count or 0
        }
    
    # === PROGRESS METRICS ===
    
    def get_progress_metrics(self, therapist_id: str, client_id: str, limit: int = 10) -> List[Dict]:
        """Get client progress metrics"""
        response = self.supabase.table('client_progress_metrics') \
            .select('*') \
            .eq('therapist_id', therapist_id) \
            .eq('client_id', client_id) \
            .order('year', desc=True) \
            .order('week_number', desc=True) \
            .limit(limit) \
            .execute()
        return response.data or []
    
    def create_progress_metric(self, therapist_id: str, client_id: str, **kwargs) -> Optional[Dict]:
        """Create progress metric record"""
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            'created_at': datetime.now(timezone.utc).isoformat(),
            **kwargs
        }
        response = self.supabase.table('client_progress_metrics').insert(data).execute()
        return response.data[0] if response.data else None
    
    # === TREATMENT OUTCOMES ===
    
    def get_treatment_outcome(self, therapist_id: str, client_id: str) -> Optional[Dict]:
        """Get treatment outcome"""
        response = self.supabase.table('treatment_outcomes') \
            .select('*') \
            .eq('therapist_id', therapist_id) \
            .eq('client_id', client_id) \
            .execute()
        return response.data[0] if response.data else None
    
    def create_or_update_treatment_outcome(self, therapist_id: str, client_id: str, **kwargs) -> Optional[Dict]:
        """Create or update treatment outcome"""
        existing = self.get_treatment_outcome(therapist_id, client_id)
        
        data = {
            'therapist_id': therapist_id,
            'client_id': client_id,
            **kwargs
        }
        
        if existing:
            response = self.supabase.table('treatment_outcomes') \
                .update(data) \
                .eq('id', existing['id']) \
                .execute()
        else:
            data['created_at'] = datetime.now(timezone.utc).isoformat()
            response = self.supabase.table('treatment_outcomes').insert(data).execute()
        
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
    ) -> Optional[Dict]:
        """Log data access for compliance"""
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
        response = self.supabase.table('data_access_audit').insert(data).execute()
        return response.data[0] if response.data else None
    
    def get_audit_logs(
        self,
        therapist_id: str = None,
        client_id: str = None,
        from_date: str = None,
        to_date: str = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get audit logs"""
        query = self.supabase.table('data_access_audit') \
            .select('*') \
            .order('accessed_at', desc=True) \
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
        return response.data or []


# === Singleton ===
_service_instance = None

def get_therapist_service() -> TherapistService:
    """Get singleton instance of TherapistService"""
    global _service_instance
    if _service_instance is None:
        _service_instance = TherapistService()
    return _service_instance
