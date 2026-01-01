try:
    import certifi
    import os
    os.environ['SSL_CERT_FILE'] = certifi.where()
except Exception as e:
    import os
    print(f"Skipping certifi config (Railway has SSL): {e}")

from datetime import datetime, timezone
from typing import List, Optional
from database import DatabaseManager

class JournalManager:
    """
    Quản lý các chức năng liên quan đến Nhật ký (Journal).
    Module này hoạt động độc lập bên cạnh DatabaseManager.
    """
    
    def __init__(self):
        # Sử dụng lại instance của DatabaseManager để tận dụng kết nối Supabase và Embedding Model
        self.db_manager = DatabaseManager()
        self.supabase = self.db_manager.supabase

    def create_entry(self, user_id: str, content: str, title: str = None, mood: str = None, tags: List[str] = None):
        """
        Lưu nhật ký mới.
        1. Lưu vào bảng `journal_entries` (dữ liệu có cấu trúc).
        2. Lưu vào bảng `session_summaries` (để AI ghi nhớ và tìm kiếm).
        """
        try:
            # 1. Lấy ID người dùng từ bảng users
            user = self.db_manager.get_or_create_user(user_id)
            user_db_id = user['id']
            
            # Chuẩn bị dữ liệu
            now = datetime.now(timezone.utc).isoformat()
            tags = tags or []
            
            # 2. Insert vào bảng journal_entries
            journal_data = {
                'user_id': user_db_id,
                'title': title,
                'content': content,
                'mood': mood,
                'tags': tags,
                'created_at': now,
                'updated_at': now
            }
            
            journal_res = self.supabase.table('journal_entries').insert(journal_data).execute()
            
            if not journal_res.data:
                raise Exception("Không thể lưu vào bảng journal_entries")
            
            journal_id = journal_res.data[0]['id']
            print(f"✅ Đã lưu Journal ID {journal_id} vào bảng journal_entries")
            
            # 3. Insert vào bảng session_summaries (cho AI Memory)
            # Format nội dung để AI dễ hiểu
            summary_text = f"[NHẬT KÝ] {title if title else 'Không tiêu đề'}\n"
            summary_text += f"Nội dung: {content}\n"
            if mood:
                summary_text += f"Cảm xúc: {mood}\n"
            if tags:
                summary_text += f"Tags: {', '.join(tags)}"
            
            # Sử dụng hàm có sẵn của DatabaseManager để xử lý embedding và lưu
            self.db_manager.add_session_summary(user_id, summary_text)
            print(f"✅ Đã lưu bản sao Journal vào session_summaries (AI Memory)")
            
            return {
                "success": True,
                "id": journal_id,
                "message": "Đã lưu nhật ký thành công"
            }
            
        except Exception as e:
            print(f"❌ Lỗi khi lưu nhật ký: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_entries(self, user_id: str, limit: int = 10, offset: int = 0):
        """Lấy danh sách nhật ký của người dùng."""
        try:
            user = self.db_manager.get_or_create_user(user_id)
            user_db_id = user['id']
            
            response = self.supabase.table('journal_entries')\
                .select('*')\
                .eq('user_id', user_db_id)\
                .order('created_at', desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
                
            return response.data
        except Exception as e:
            print(f"❌ Lỗi khi lấy danh sách nhật ký: {str(e)}")
            return []

    def delete_entry(self, entry_id: int, user_id: str):
        """Xóa nhật ký (chỉ xóa trong journal_entries, giữ lại ký ức AI hoặc xóa cả 2 tùy logic - hiện tại xóa 1)"""
        try:
            # Cần verify user sở hữu entry này trước khi xóa (để an toàn)
            # Nhưng ở đây ta tin tưởng user_id truyền vào từ auth middleware
            
            response = self.supabase.table('journal_entries')\
                .delete()\
                .eq('id', entry_id)\
                .execute()
                
            return {"success": True, "message": "Đã xóa nhật ký"}
        except Exception as e:
            return {"success": False, "error": str(e)}
