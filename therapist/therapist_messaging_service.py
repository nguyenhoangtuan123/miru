"""
Therapist Messaging Service
Quản lý nhắn tin trực tiếp giữa NTL và thân chủ
"""

from datetime import datetime, timezone
from typing import List, Dict, Any, Optional


class TherapistMessagingService:
    """Service cho nhắn tin giữa NTL và thân chủ"""
    
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
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
    
    def get_recent_conversations(self, therapist_id: str, limit: int = 20) -> List[Dict]:
        """Lấy danh sách cuộc trò chuyện gần đây với thông tin thân chủ"""
        # Lấy tin nhắn mới nhất của mỗi client
        response = self.supabase.table('therapist_client_messages')\
            .select('''
                client_id,
                message_content,
                sender_type,
                is_read,
                created_at,
                users!client_id(id, name, email, picture)
            ''')\
            .eq('therapist_id', therapist_id)\
            .order('created_at', desc=True)\
            .limit(limit * 10)\
            .execute()
        
        # Group by client và lấy tin nhắn mới nhất
        conversations = {}
        for msg in response.data:
            client_id = msg['client_id']
            if client_id not in conversations:
                conversations[client_id] = {
                    'client': msg['users'],
                    'last_message': msg['message_content'],
                    'last_sender': msg['sender_type'],
                    'last_time': msg['created_at'],
                    'unread_count': 0
                }
            if msg['sender_type'] == 'client' and not msg.get('is_read', False):
                conversations[client_id]['unread_count'] += 1
        
        return list(conversations.values())[:limit]