# file: user_service.py
"""
User Profile & Privacy Settings Service
Quản lý hồ sơ người dùng và cài đặt riêng tư
"""

import os
from datetime import datetime, timezone
from typing import Dict, Optional, List
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


class UserService:
    """Service cho User Profile & Privacy Settings"""
    
    def __init__(self):
        url = os.environ.get("SUPABASE_URL", "").strip()
        key = os.environ.get("SUPABASE_KEY", "").strip()
        if not url or not key:
            raise ValueError("SUPABASE_URL và SUPABASE_KEY cần được thiết lập")
        self.supabase: Client = create_client(url, key)
        print("✅ UserService initialized")
    
    # === USER PROFILE ===
    
    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Lấy hồ sơ mở rộng của user"""
        try:
            response = self.supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error fetching user profile: {e}")
            return None
    
    def create_or_update_profile(
        self,
        user_id: str,
        date_of_birth: str = None,
        gender: str = None,
        phone: str = None,
        address: str = None,
        emergency_contact_name: str = None,
        emergency_contact_phone: str = None
    ) -> Dict:
        """Tạo hoặc cập nhật hồ sơ user"""
        data = {
            'user_id': user_id,
            'date_of_birth': date_of_birth,
            'gender': gender,
            'phone': phone,
            'address': address,
            'emergency_contact_name': emergency_contact_name,
            'emergency_contact_phone': emergency_contact_phone,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Check if exists
        existing = self.get_user_profile(user_id)
        if existing:
            response = self.supabase.table('user_profiles').update(data).eq('user_id', user_id).execute()
        else:
            data['created_at'] = datetime.now(timezone.utc).isoformat()
            response = self.supabase.table('user_profiles').insert(data).execute()
        
        return response.data[0] if response.data else {}
    
    def delete_profile(self, user_id: str) -> bool:
        """Xóa hồ sơ mở rộng (không xóa user)"""
        try:
            self.supabase.table('user_profiles').delete().eq('user_id', user_id).execute()
            return True
        except Exception as e:
            print(f"Error deleting user profile: {e}")
            return False
    
    # === PRIVACY SETTINGS ===
    
    def get_privacy_settings(self, user_id: str) -> Optional[Dict]:
        """Lấy cài đặt riêng tư của user"""
        try:
            response = self.supabase.table('user_privacy_settings').select('*').eq('user_id', user_id).execute()
            return response.data[0] if response.data else None
        except Exception as e:
            print(f"Error fetching privacy settings: {e}")
            return None
    
    def create_or_update_privacy_settings(
        self,
        user_id: str,
        allow_therapist_chat_history: bool = False,
        allow_therapist_mood_journal: bool = False,
        allow_therapist_assignments: bool = True,
        allow_therapist_goals: bool = False,
        allow_therapist_memories: bool = False,
        share_history_days: int = 30,
        notify_when_therapist_access: bool = True
    ) -> Dict:
        """Tạo hoặc cập nhật cài đặt riêng tư"""
        data = {
            'user_id': user_id,
            'allow_therapist_chat_history': allow_therapist_chat_history,
            'allow_therapist_mood_journal': allow_therapist_mood_journal,
            'allow_therapist_assignments': allow_therapist_assignments,
            'allow_therapist_goals': allow_therapist_goals,
            'allow_therapist_memories': allow_therapist_memories,
            'share_history_days': share_history_days,
            'notify_when_therapist_access': notify_when_therapist_access,
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Check if exists
        existing = self.get_privacy_settings(user_id)
        if existing:
            response = self.supabase.table('user_privacy_settings').update(data).eq('user_id', user_id).execute()
        else:
            data['created_at'] = datetime.now(timezone.utc).isoformat()
            response = self.supabase.table('user_privacy_settings').insert(data).execute()
        
        return response.data[0] if response.data else {}
    
    def update_single_privacy_setting(self, user_id: str, key: str, value) -> bool:
        """Cập nhật một cài đặt riêng tư duy nhất"""
        allowed_keys = [
            'allow_therapist_chat_history',
            'allow_therapist_mood_journal',
            'allow_therapist_assignments',
            'allow_therapist_goals',
            'allow_therapist_memories',
            'share_history_days',
            'notify_when_therapist_access'
        ]
        
        if key not in allowed_keys:
            raise ValueError(f"Invalid privacy setting key: {key}")
        
        try:
            self.supabase.table('user_privacy_settings').update({
                key: value,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).eq('user_id', user_id).execute()
            return True
        except Exception as e:
            print(f"Error updating privacy setting: {e}")
            return False
    
    # === DATA EXPORT ===
    
    def export_user_data(self, user_id: str) -> Dict:
        """Xuất tất cả dữ liệu của user (GDPR compliance)"""
        result = {
            'user_id': user_id,
            'export_date': datetime.now(timezone.utc).isoformat(),
            'data': {}
        }
        
        try:
            # User basic info
            user_resp = self.supabase.table('users').select('*').eq('id', user_id).execute()
            if user_resp.data:
                result['data']['basic_info'] = user_resp.data[0]
            
            # User profile
            profile_resp = self.supabase.table('user_profiles').select('*').eq('user_id', user_id).execute()
            if profile_resp.data:
                result['data']['profile'] = profile_resp.data[0]
            
            # Privacy settings
            privacy_resp = self.supabase.table('user_privacy_settings').select('*').eq('user_id', user_id).execute()
            if privacy_resp.data:
                result['data']['privacy_settings'] = privacy_resp.data[0]
            
            # Chat messages (last 100)
            messages_resp = self.supabase.table('chat_messages').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(100).execute()
            if messages_resp.data:
                result['data']['chat_messages'] = messages_resp.data
            
            # Journal entries
            journal_resp = self.supabase.table('journal_entries').select('*').eq('user_id', user_id).execute()
            if journal_resp.data:
                result['data']['journal_entries'] = journal_resp.data
            
            # Goals
            goals_resp = self.supabase.table('goals').select('*').eq('user_id', user_id).execute()
            if goals_resp.data:
                result['data']['goals'] = goals_resp.data
            
            # Moment checkins
            checkin_resp = self.supabase.table('moment_checkins').select('*').eq('user_id', user_id).execute()
            if checkin_resp.data:
                result['data']['moment_checkins'] = checkin_resp.data
            
            return result
            
        except Exception as e:
            print(f"Error exporting user data: {e}")
            result['error'] = str(e)
            return result
    
    # === DATA DELETION REQUEST ===
    
    def create_deletion_request(self, user_id: str, reason: str = None) -> Dict:
        """Tạo yêu cầu xóa tài khoản (GDPR right to erasure)"""
        data = {
            'user_id': user_id,
            'reason': reason,
            'status': 'pending',
            'requested_at': datetime.now(timezone.utc).isoformat(),
            'scheduled_deletion_at': datetime.now(timezone.utc).isoformat()  # Default, will be updated
        }
        
        # Schedule deletion for 30 days from now
        from datetime import timedelta
        data['scheduled_deletion_at'] = datetime.now(timezone.utc) + timedelta(days=30)
        
        try:
            response = self.supabase.table('account_deletion_requests').insert(data).execute()
            return response.data[0] if response.data else {}
        except Exception as e:
            print(f"Error creating deletion request: {e}")
            return {'error': str(e)}
    
    def cancel_deletion_request(self, user_id: str) -> bool:
        """Hủy yêu cầu xóa tài khoản"""
        try:
            self.supabase.table('account_deletion_requests').update({
                'status': 'cancelled'
            }).eq('user_id', user_id).eq('status', 'pending').execute()
            return True
        except Exception as e:
            print(f"Error cancelling deletion request: {e}")
            return False
    
    # === THERAPIST DATA ACCESS ===
    
    def get_therapist_accessible_data(self, client_id: str, therapist_id: str) -> Dict:
        """Lấy dữ liệu mà therapist có thể truy cập (dựa trên privacy settings)"""
        privacy = self.get_privacy_settings(client_id)
        
        result = {
            'client_id': client_id,
            'therapist_id': therapist_id,
            'accessible_data': {},
            'consent_given': {}
        }
        
        if not privacy:
            # Default: no access
            return result
        
        # Check each permission
        permissions = [
            ('allow_therapist_chat_history', 'chat_history'),
            ('allow_therapist_mood_journal', 'mood_journal'),
            ('allow_therapist_assignments', 'assignments'),
            ('allow_therapist_goals', 'goals'),
            ('allow_therapist_memories', 'memories')
        ]
        
        for db_key, data_key in permissions:
            if privacy.get(db_key, False):
                result['consent_given'][data_key] = True
                # Log access
                self.log_data_access(client_id, therapist_id, 'view', data_key)
            else:
                result['consent_given'][data_key] = False
        
        return result
    
    def log_data_access(self, client_id: str, accessor_id: str, action: str, resource_type: str) -> bool:
        """Ghi log truy cập dữ liệu (audit trail)"""
        try:
            self.supabase.table('data_access_audit').insert({
                'client_id': client_id,
                'accessor_id': accessor_id,
                'accessor_type': 'therapist',
                'action': action,
                'resource_type': resource_type,
                'accessed_at': datetime.now(timezone.utc).isoformat()
            }).execute()
            return True
        except Exception as e:
            print(f"Error logging data access: {e}")
            return False
    
    # === CONSENT MANAGEMENT ===
    
    def log_consent_change(self, user_id: str, therapist_id: str, consent_type: str, consent_given: bool) -> bool:
        """Ghi log thay đổi consent"""
        try:
            self.supabase.table('privacy_consent_log').insert({
                'user_id': user_id,
                'therapist_id': therapist_id,
                'consent_type': consent_type,
                'consent_given': consent_given,
                'consent_date': datetime.now(timezone.utc).isoformat()
            }).execute()
            
            # Also update the privacy setting
            self.update_single_privacy_setting(user_id, consent_type, consent_given)
            return True
        except Exception as e:
            print(f"Error logging consent change: {e}")
            return False


# Singleton instance
_user_service = None

def get_user_service() -> UserService:
    """Get or create UserService singleton"""
    global _user_service
    if _user_service is None:
        _user_service = UserService()
    return _user_service
