"""
Therapist Group Service
Quản lý nhóm thân chủ
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


class TherapistGroupService:
    """Service cho nhóm thân chủ"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
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
    
    def get_client_groups_for_client(self, client_id: str, therapist_id: str) -> List[Dict]:
        """Lấy danh sách nhóm mà một thân chủ thuộc về"""
        response = self.supabase.table('therapist_client_group_members')\
            .select('group:therapist_client_groups(*)')\
            .eq('client_id', client_id)\
            .eq('group.therapist_id', therapist_id)\
            .execute()
        return [item['group'] for item in response.data] if response.data else []