"""
Chat Manager - Quản lý conversations và chat sessions
Không sửa database.py, chỉ sử dụng DatabaseManager
"""

from database import DatabaseManager
from datetime import datetime, timezone
import uuid


class ChatManager:
    """Quản lý chat sessions và conversation history"""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
    
    def generate_title_from_message(self, message: str) -> str:
        """
        Tạo title từ tin nhắn đầu tiên.
        
        Strategies:
        1. Nếu message ngắn (<50 chars): dùng chính message làm title
        2. Nếu message dài: lấy 40-50 ký tự đầu + "..."
        """
        if not message:
            return "Cuộc trò chuyện mới"
        
        # Clean message
        cleaned_message = message.strip()
        
        # Remove extra whitespace
        cleaned_message = ' '.join(cleaned_message.split())
        
        # If message is short, use it directly
        if len(cleaned_message) <= 50:
            return cleaned_message
        
        # If message is longer, truncate
        return cleaned_message[:47] + "..."
    
    def create_session_with_first_message(self, user_id: str, first_message: str, role: str = "user"):
        """
        Tạo session mới với title được trích từ tin nhắn đầu tiên.
        
        Args:
            user_id: User ID
            first_message: Tin nhắn đầu tiên của người dùng
            role: Vai trò người gửi (mặc định "user")
        
        Returns:
            dict: {success, session_id, title}
        """
        try:
            # Generate title from message
            title = self.generate_title_from_message(first_message)
            
            # Create session
            session_result = self.create_new_session(user_id, title)
            
            if not session_result.get("success"):
                return session_result
            
            session_id = session_result["session_id"]
            
            # Save the first message
            self.save_message(session_id, user_id, role, first_message)
            
            print(f"[SUCCESS] Created session {session_id} with auto-generated title: {title}")
            
            return {
                "success": True,
                "session_id": session_id,
                "title": title
            }
            
        except Exception as e:
            print(f"[ERROR] Error creating session with first message: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def create_new_session(self, user_id: str, title: str = "New Conversation"):
        """
        Tạo session mới cho user.
        Trả về session_id.
        """
        try:
            # Get user from database
            user = self.db_manager.get_or_create_user(user_id)
            user_db_id = user['id']
            
            # Tạo session mới trong session_summaries
            # Sử dụng summary_text để lưu metadata
            session_metadata = {
                "_record_type": "chat_session",
                "title": title,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
                "message_count": 0
            }
            
            import json
            summary_text = json.dumps(session_metadata)
            
            # Use empty embedding placeholder (database updated to 768 dimensions for text-embedding-004)
            # Session embedding will be updated when session is summarized
            embedding = [0.0] * 768
            
            response = self.db_manager.supabase.table('session_summaries').insert({
                'user_id': user_db_id,
                'summary_text': summary_text,
                'embedding': embedding
            }).execute()
            
            if response.data:
                session_id = response.data[0]['id']
                print(f"[SUCCESS] Created new session {session_id} for user {user_id}")
                return {
                    "success": True,
                    "session_id": session_id,
                    "title": title
                }
            else:
                return {"success": False, "error": "Failed to create session"}
                
        except Exception as e:
            print(f"[ERROR] Error creating session: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def end_session(self, session_id: int, final_summary: str = None):
        """
        Kết thúc session (đánh dấu là ended).
        Cập nhật summary nếu có.
        """
        try:
            # Lấy session hiện tại
            response = self.db_manager.supabase.table('session_summaries')\
                .select('summary_text')\
                .eq('id', session_id)\
                .execute()
            
            if not response.data:
                return {"success": False, "error": "Session not found"}
            
            import json
            metadata = json.loads(response.data[0]['summary_text'])
            metadata['status'] = 'ended'
            metadata['ended_at'] = datetime.now(timezone.utc).isoformat()
            
            if final_summary:
                metadata['final_summary'] = final_summary
            
            # Update session
            update_response = self.db_manager.supabase.table('session_summaries')\
                .update({'summary_text': json.dumps(metadata)})\
                .eq('id', session_id)\
                .execute()
            
            print(f"[SUCCESS] Ended session {session_id}")
            return {"success": True, "session_id": session_id}
            
        except Exception as e:
            print(f"[ERROR] Error ending session: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_user_sessions(self, user_id: str, limit: int = 20):
        """
        Lấy danh sách conversations của user.
        Trả về list sessions với title, created_at, status.
        """
        try:
            user = self.db_manager.get_or_create_user(user_id)
            user_db_id = user['id']
            
            # Lấy sessions
            response = self.db_manager.supabase.table('session_summaries')\
                .select('id, summary_text, created_at')\
                .eq('user_id', user_db_id)\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            
            if not response.data:
                return {"success": True, "sessions": []}
            
            import json
            sessions = []
            for item in response.data:
                try:
                    metadata = json.loads(item['summary_text'])
                    sessions.append({
                        "id": item['id'],
                        "title": metadata.get('title', 'Untitled'),
                        "created_at": item['created_at'],
                        "status": metadata.get('status', 'active'),
                        "message_count": metadata.get('message_count', 0)
                    })
                except:
                    # Nếu không parse được, bỏ qua
                    continue
            
            return {"success": True, "sessions": sessions}
            
        except Exception as e:
            print(f"[ERROR] Error getting sessions: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def update_session_title(self, session_id: int, new_title: str, user_id: str = None):
        """Cập nhật title của session"""
        try:
            # Verify ownership if user_id provided
            if user_id:
                user = self.db_manager.get_or_create_user(user_id)
                user_db_id = user['id']
                
                response = self.db_manager.supabase.table('session_summaries')\
                    .select('user_id, summary_text')\
                    .eq('id', session_id)\
                    .execute()
                
                if not response.data:
                    return {"success": False, "error": "Session not found"}
                
                if response.data[0]['user_id'] != user_db_id:
                    return {"success": False, "error": "Unauthorized"}
            
            # Lấy session
            response = self.db_manager.supabase.table('session_summaries')\
                .select('summary_text')\
                .eq('id', session_id)\
                .execute()
            
            if not response.data:
                return {"success": False, "error": "Session not found"}
            
            import json
            metadata = json.loads(response.data[0]['summary_text'])
            metadata['title'] = new_title
            metadata['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            # Update
            self.db_manager.supabase.table('session_summaries')\
                .update({'summary_text': json.dumps(metadata)})\
                .eq('id', session_id)\
                .execute()
            
            return {"success": True, "title": new_title}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def increment_message_count(self, session_id: int):
        """Tăng message count của session"""
        try:
            response = self.db_manager.supabase.table('session_summaries')\
                .select('summary_text')\
                .eq('id', session_id)\
                .execute()
            
            if response.data:
                import json
                metadata = json.loads(response.data[0]['summary_text'])
                metadata['message_count'] = metadata.get('message_count', 0) + 1
                
                self.db_manager.supabase.table('session_summaries')\
                    .update({'summary_text': json.dumps(metadata)})\
                    .eq('id', session_id)\
                    .execute()
                
        except Exception as e:
            print(f"Warning: Could not increment message count: {str(e)}")
    
    def delete_session(self, session_id: int, user_id: str):
        """Xóa session (soft delete - đánh dấu deleted)"""
        try:
            # Verify ownership
            user = self.db_manager.get_or_create_user(user_id)
            user_db_id = user['id']
            
            response = self.db_manager.supabase.table('session_summaries')\
                .select('user_id, summary_text')\
                .eq('id', session_id)\
                .execute()
            
            if not response.data:
                return {"success": False, "error": "Session not found"}
            
            if response.data[0]['user_id'] != user_db_id:
                return {"success": False, "error": "Unauthorized"}
            
            # Soft delete
            import json
            metadata = json.loads(response.data[0]['summary_text'])
            metadata['status'] = 'deleted'
            metadata['deleted_at'] = datetime.now(timezone.utc).isoformat()
            
            self.db_manager.supabase.table('session_summaries')\
                .update({'summary_text': json.dumps(metadata)})\
                .eq('id', session_id)\
                .execute()
            
            return {"success": True}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def save_message(self, session_id: int, user_id: str, role: str, content: str):
        """Lưu message vào database"""
        try:
            print(f"[CHAT_MANAGER] save_message called: session_id={session_id}, user_id={user_id}, role={role}")
            print(f"[CHAT_MANAGER] content length: {len(content)}")
            
            # Validate inputs
            if not session_id:
                print("[CHAT_MANAGER] ERROR: session_id is empty or None")
                return {"success": False, "error": "session_id is required"}
            if not user_id:
                print("[CHAT_MANAGER] ERROR: user_id is empty or None")
                return {"success": False, "error": "user_id is required"}
            if not role:
                print("[CHAT_MANAGER] ERROR: role is empty or None")
                return {"success": False, "error": "role is required"}
            if not content:
                print("[CHAT_MANAGER] ERROR: content is empty or None")
                return {"success": False, "error": "content is required"}
            
            # Ensure session_id is integer
            try:
                session_id_int = int(session_id)
            except (ValueError, TypeError) as e:
                print(f"[CHAT_MANAGER] ERROR: session_id is not a valid integer: {session_id}")
                return {"success": False, "error": f"Invalid session_id: {e}"}
            
            print(f"[CHAT_MANAGER] Inserting into chat_messages table...")
            response = self.db_manager.supabase.table('chat_messages').insert({
                'session_id': session_id_int,
                'user_id': user_id,
                'role': role,
                'content': content
            }).execute()
            
            print(f"[CHAT_MANAGER] Insert response: data={response.data is not None}, count={len(response.data) if response.data else 0}")
            
            if response.data:
                message_id = response.data[0]['id']
                print(f"[CHAT_MANAGER] Message saved successfully, id={message_id}")
                # Increment message count
                self.increment_message_count(session_id_int)
                return {"success": True, "message_id": message_id}
            else:
                error_msg = "No data returned from insert"
                if hasattr(response, 'error') and response.error:
                    error_msg = str(response.error)
                print(f"[CHAT_MANAGER] ERROR: Failed to save message - {error_msg}")
                return {"success": False, "error": error_msg}
                
        except Exception as e:
            print(f"[CHAT_MANAGER] EXCEPTION: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
    
    def get_session_messages(self, session_id: int, limit: int = 100):
        """Lấy messages của một session"""
        try:
            print(f"[CHAT_MANAGER] get_session_messages called: session_id={session_id}, limit={limit}")
            
            # Ensure session_id is integer
            try:
                session_id_int = int(session_id)
            except (ValueError, TypeError) as e:
                print(f"[CHAT_MANAGER] ERROR: session_id is not a valid integer: {session_id}")
                return {"success": False, "error": f"Invalid session_id: {e}"}
            
            print(f"[CHAT_MANAGER] Querying chat_messages table for session_id={session_id_int}")
            response = self.db_manager.supabase.table('chat_messages')\
                .select('id, role, content, created_at')\
                .eq('session_id', session_id_int)\
                .order('created_at', desc=False)\
                .limit(limit)\
                .execute()
            
            print(f"[CHAT_MANAGER] Query response: data={response.data is not None}, count={len(response.data) if response.data else 0}")
            
            if response.data:
                messages = [{
                    "id": msg['id'],
                    "role": msg['role'],
                    "content": msg['content'],
                    "created_at": msg['created_at']
                } for msg in response.data]
                print(f"[CHAT_MANAGER] Returning {len(messages)} messages")
                return {"success": True, "messages": messages}
            else:
                print(f"[CHAT_MANAGER] No messages found for session {session_id_int}")
                return {"success": True, "messages": []}
                
        except Exception as e:
            print(f"[CHAT_MANAGER] EXCEPTION: Error getting messages: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}
