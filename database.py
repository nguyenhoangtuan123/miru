# file: database.py

import os
import ssl
import json
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai


# --- FIX SSL ERROR (Dev Environment) ---
# Bỏ qua xác thực SSL cho toàn bộ process để tránh lỗi "certificate verify failed"
# khi kết nối Supabase từ môi trường Windows thiếu cert.
# ssl._create_default_https_context = ssl._create_unverified_context  # Disabled for Railway

# Tải các biến môi trường từ file .env
load_dotenv()

class DatabaseManager:
    """
    Quản lý tất cả các tương tác với database, bao gồm Supabase (dữ liệu quan hệ)"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        # Chỉ khởi tạo 1 lần
        if hasattr(self, '_initialized'):
            return
        self._initialized = True
        
        url: str = os.environ.get("SUPABASE_URL", "").strip().strip('"').strip("'")
        key: str = os.environ.get("SUPABASE_KEY", "").strip().strip('"').strip("'")
        
        print(f"DEBUG: Connecting to Supabase URL: '{url}'")
        
        # Diagnostic: Check DNS resolution
        
        # Diagnostic: Check DNS resolution - DISABLED for production to avoid blocking
        # import socket
        # try:
        #     hostname = url.replace("https://", "").replace("http://", "").split("/")[0]
        #     print(f"DEBUG: Attempting to resolve hostname: '{hostname}'")
        #     ip = socket.gethostbyname(hostname)
        #     print(f"DEBUG: Successfully resolved {hostname} to {ip}")
        # except Exception as e:
        #     print(f"[ERROR] DEBUG: Failed to resolve hostname {hostname}: {e}")
        
        if not url or not key:
            raise ValueError("SUPABASE_URL và SUPABASE_KEY phải được thiết lập trong file .env")
        self.supabase: Client = create_client(url, key)
                # Configure Google Gemini for embeddings
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        print("[OK] Google Gemini embedding API configured.")

        print("DatabaseManager (Supabase) initialized.")
    
    def _get_embedding(self, text: str) -> list:
        """Get embedding vector using Google's text-embedding-004 API"""
        try:
            result = genai.embed_content(
                model="models/text-embedding-004",
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"Error getting embedding: {e}")
            # Fallback: return zero vector if API fails
            return [0.0] * 768  # text-embedding-004 returns 768 dimensions
            
    def get_or_create_user(self, user_id: str, name: str = None, email: str = None):
        """Lấy hoặc tạo người dùng trong bảng 'users'."""
        # Use 'id' instead of 'user_id_str'
        response = self.supabase.table('users').select('id, name').eq('id', user_id).execute()
        
        if response.data:
            user = response.data[0]
            if name and name != user.get('name'):
                 self.supabase.table('users').update({'name': name}).eq('id', user_id).execute()
            return user
        else:
            # Insert with 'id'
            response = self.supabase.table('users').insert({'id': user_id, 'name': name or 'Anonymous', 'email': email or f"{user_id}@placeholder.local"}).execute()
            return response.data[0]

    def add_session_summary(self, user_id: str, summary_text: str):
        """Lưu tóm tắt vào Supabase và tạo embedding."""
        # user_id is now the Google ID (string)
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']

        embedding = self._get_embedding(summary_text)

        response = self.supabase.table('session_summaries').insert({
            'user_id': user_db_id,
            'summary_text': summary_text,
            'embedding': embedding
        }).execute()

        if response.data:
            session_id = response.data[0]['id']
            return f"Đã lưu tóm tắt session ID: {session_id}"
        else:
            error_message = response.error.message if response.error else "Unknown error"
            raise Exception(f"Lỗi khi lưu tóm tắt: {error_message}")

    def find_relevant_summaries(self, user_id: str, query_text: str, n_results: int = 3):
        """Tìm kiếm ngữ nghĩa và trả về kèm timestamp (GMT+7)."""
        
        query_embedding = self._get_embedding(query_text)

        # Note: The RPC function 'match_summaries' might still expect 'user_id_str_param'
        # We should check if we need to update the RPC function or just pass the ID
        # Assuming we update RPC to take 'user_id_param' which matches 'id' column
        response = self.supabase.rpc('match_summaries', {
            'query_embedding': query_embedding,
            'user_id_param': user_id, # Changed from user_id_str_param
            'match_count': n_results
        }).execute()
        
        if response.data:
            results = []
            
            for item in response.data:
                text = item['summary_text']
                created_str = item.get('created_at')
                
                if created_str:
                    # Parse timestamp (UTC)
                    created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    
                    # Convert sang giờ Việt Nam (GMT+7)
                    vn_tz = timezone(timedelta(hours=7))
                    created_vn = created_dt.astimezone(vn_tz)
                    now_vn = datetime.now(vn_tz)
                    
                    # Tính khoảng cách
                    delta = now_vn - created_vn
                    
                    # Format hiển thị
                    date_str = created_vn.strftime("%Y-%m-%d %H:%M") # Thêm giờ phút
                    
                    if delta.days == 0 and created_vn.day == now_vn.day:
                        time_ago = "hôm nay"
                    elif delta.days <= 1 and (now_vn.date() - created_vn.date()).days == 1:
                        time_ago = "hôm qua"
                    elif delta.days <= 2 and (now_vn.date() - created_vn.date()).days == 2:
                        time_ago = "hôm kia"
                    elif delta.days < 7:
                        time_ago = f"{delta.days} ngày trước"
                    else:
                        time_ago = created_vn.strftime("%d/%m")

                    results.append(f"[{date_str} ({time_ago})] {text}")
                else:
                    results.append(text)
            
            return results
        return []

    def get_latest_session_summary(self, user_id: str):
        """Lấy tóm tắt phiên gần nhất (theo thời gian) để tính khoảng cách."""
        
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']

        # Lấy record mới nhất theo created_at
        response = self.supabase.table('session_summaries')\
            .select('summary_text, created_at')\
            .eq('user_id', user_db_id)\
            .order('created_at', desc=True)\
            .limit(1)\
            .execute()
            
        if response.data:
            item = response.data[0]
            text = item['summary_text']
            created_str = item.get('created_at')
            
            if created_str:
                # Parse timestamp (UTC)
                created_dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                
                # Convert sang giờ Việt Nam (GMT+7)
                vn_tz = timezone(timedelta(hours=7))
                created_vn = created_dt.astimezone(vn_tz)
                
                date_str = created_vn.strftime("%Y-%m-%d %H:%M")
                return f"[Phiên gần nhất: {date_str}] {text}"
            return f"[Phiên gần nhất] {text}"
        return "Chưa có ký ức nào."

    def get_memories_by_date(self, user_id: str, target_date_str: str):
        """
        Lấy các tóm tắt trong một ngày cụ thể (YYYY-MM-DD).
        Hữu ích cho câu hỏi: "Hôm qua tôi nói gì?", "Ngày 20/11 tôi làm gì?"
        """
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']

        # Tạo range cho ngày đó (tính theo giờ UTC để query chính xác hoặc đơn giản là filter theo ngày)
        # Supabase lưu UTC. Để chính xác với giờ VN (GMT+7), ta cần tính range UTC tương ứng.
        # Ngày T tại VN bắt đầu từ T-1 17:00 UTC đến T 16:59:59 UTC.
        
        try:
            # target_date_str: YYYY-MM-DD
            target_date = datetime.strptime(target_date_str, "%Y-%m-%d")
            
            # Start of day in VN: 00:00 GMT+7 -> 17:00 (prev day) UTC
            vn_tz = timezone(timedelta(hours=7))
            start_of_day_vn = target_date.replace(tzinfo=vn_tz)
            end_of_day_vn = start_of_day_vn + timedelta(days=1) - timedelta(microseconds=1)
            
            start_utc = start_of_day_vn.astimezone(timezone.utc)
            end_utc = end_of_day_vn.astimezone(timezone.utc)
            
            response = self.supabase.table('session_summaries')\
                .select('summary_text, created_at')\
                .eq('user_id', user_db_id)\
                .gte('created_at', start_utc.isoformat())\
                .lte('created_at', end_utc.isoformat())\
                .order('created_at', desc=False)\
                .execute()
                
            if response.data:
                results = []
                for item in response.data:
                    text = item['summary_text']
                    # Format giờ cho đẹp
                    created_str = item.get('created_at')
                    time_label = ""
                    if created_str:
                        dt = datetime.fromisoformat(created_str.replace('Z', '+00:00')).astimezone(vn_tz)
                        time_label = dt.strftime("%H:%M")
                    results.append(f"[{time_label}] {text}")
                return "\n".join(results)
            return f"Không tìm thấy ký ức nào trong ngày {target_date_str}."
            
        except ValueError:
            return "Lỗi định dạng ngày (yêu cầu YYYY-MM-DD)."
        except Exception as e:
            return f"Lỗi truy xuất theo ngày: {str(e)}"

    def get_session_timeline(self, user_id: str, days: int = 30):
        """
        Lấy timeline của các session trong N ngày gần đây.
        Trả về list timestamps (ISO format) để phân tích gaps.
        """
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']
        
        # Tính thời điểm N ngày trước
        cutoff_datetime = datetime.now(timezone.utc) - timedelta(days=days)
        
        response = self.supabase.table('session_summaries')\
            .select('created_at')\
            .eq('user_id', user_db_id)\
            .gte('created_at', cutoff_datetime.isoformat())\
            .order('created_at', desc=False)\
            .execute()
        
        if response.data:
            timestamps = []
            for item in response.data:
                created_str = item.get('created_at')
                if created_str:
                    dt = datetime.fromisoformat(created_str.replace('Z', '+00:00'))
                    timestamps.append(dt.isoformat())
            return timestamps
        return []

    def get_user_profile_summary(self, user_id: str):
        """Lấy tóm tắt hồ sơ từ Supabase."""
        # Use 'id' instead of 'user_id_str'
        user_response = self.supabase.table('users').select('id, name').eq('id', user_id).execute()
        if not user_response.data:
            return "Không tìm thấy người dùng."
        
        user = user_response.data[0]
        user_db_id = user['id']

        details_response = self.supabase.table('personal_details').select('key, value').eq('user_id', user_db_id).execute()
        summaries_count_response = self.supabase.table('session_summaries').select('id', count='exact').eq('user_id', user_db_id).execute()
        
        details = {item['key']: item['value'] for item in details_response.data}
        summaries_count = summaries_count_response.count if summaries_count_response.count is not None else 0

        summary_lines = [f"Hồ sơ cho người dùng: {user['name'] or user_id}"]
        summary_lines.extend([f"- {key}: {value}" for key, value in details.items()])
        summary_lines.append(f"Số phiên đã lưu: {summaries_count}")

        return "\n".join(summary_lines)

    def update_personal_detail(self, user_id: str, key: str, value: str):
        """Cập nhật chi tiết cá nhân bằng upsert."""
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']

        self.supabase.table('personal_details').upsert({
            'user_id': user_db_id,
            'key': key,
            'value': value
        }, on_conflict='user_id, key').execute()
        
        return f"Đã cập nhật '{key}' thành '{value}'."

    def analyze_patterns_simple(self, user_id: str, keyword: str):
        """Phân tích mẫu hình đơn giản trên Supabase."""
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']

        total_response = self.supabase.table('session_summaries').select('id', count='exact').eq('user_id', user_db_id).execute()
        total_sessions = total_response.count if total_response.count is not None else 0
        if total_sessions == 0:
            return "Chưa có dữ liệu để phân tích."

        keyword_response = self.supabase.table('session_summaries').select('id', count='exact').eq('user_id', user_db_id).ilike('summary_text', f'%{keyword}%').execute()
        count = keyword_response.count if keyword_response.count is not None else 0
        
        if total_sessions > 0:
            percentage = (count / total_sessions) * 100
            return f"Từ khóa '{keyword}' xuất hiện trong {count}/{total_sessions} phiên ({percentage:.2f}%)."
        return f"Từ khóa '{keyword}' xuất hiện trong {count}/{total_sessions} phiên."

    def log_activity(self, user_id: str, activity_type: str):
        """
        Log user activity (sleep_start, wake_up, etc.)
        Lưu vào personal_details dạng JSON: activities_log
        """
        import json
        from datetime import datetime, timezone
        
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']
        
        # Lấy activities_log hiện tại
        response = self.supabase.table('personal_details')\
            .select('value')\
            .eq('user_id', user_db_id)\
            .eq('key', 'activities_log')\
            .execute()
        
        if response.data:
            activities = json.loads(response.data[0]['value'])
        else:
            activities = []
        
        # Thêm activity mới
        new_activity = {
            'type': activity_type,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        activities.append(new_activity)
        
        # Giữ tối đa 100 activities gần nhất
        activities = activities[-100:]
        
        # Save lại
        self.supabase.table('personal_details').upsert({
            'user_id': user_db_id,
            'key': 'activities_log',
            'value': json.dumps(activities)
        }, on_conflict='user_id, key').execute()
        
        return f"Đã log activity: {activity_type}"

    def get_recent_activities(self, user_id: str, activity_type: str = None, limit: int = 10):
        """Lấy activities gần đây"""
        import json
        
        user = self.get_or_create_user(user_id)
        user_db_id = user['id']
        
        response = self.supabase.table('personal_details')\
            .select('value')\
            .eq('user_id', user_db_id)\
            .eq('key', 'activities_log')\
            .execute()
        
        if not response.data:
            return []
        
        activities = json.loads(response.data[0]['value'])
        
        # Filter by type if specified
        if activity_type:
            activities = [a for a in activities if a['type'] == activity_type]
        
        return activities[-limit:]

    def calculate_last_sleep_duration(self, user_id: str):
        """
        Tìm cặp sleep_start + wake_up gần nhất, tính số giờ ngủ.
        Trả về: (hours, sleep_start_time, wake_time) hoặc None
        """
        from datetime import datetime
        
        activities = self.get_recent_activities(user_id, limit=50)
        
        # Tìm wake_up gần nhất
        wake_up = None
        sleep_start = None
        
        for activity in reversed(activities):
            if activity['type'] == 'wake_up' and not wake_up:
                wake_up = activity
            elif activity['type'] == 'sleep_start' and wake_up and not sleep_start:
                sleep_start = activity
                break
        
        if sleep_start and wake_up:
            sleep_dt = datetime.fromisoformat(sleep_start['timestamp'])
            wake_dt = datetime.fromisoformat(wake_up['timestamp'])
            
            duration = (wake_dt - sleep_dt).total_seconds() / 3600  # hours
            
            return {
                'hours': round(duration, 1),
                'sleep_time': sleep_dt.isoformat(),
                'wake_time': wake_dt.isoformat()
            }
        
        return None

    def save_analyzed_session(self, session_id: int, user_id: str, analysis_data: dict):
        """Lưu kết quả phân tích phiên vào bảng analyzed_sessions."""
        try:
            # Prepare data
            data = {
                'session_id': session_id,
                'user_id': user_id,
                'emotion_score': analysis_data.get('emotion_score'),
                'dominant_emotion': analysis_data.get('dominant_emotion'),
                'topics': analysis_data.get('topics', []),
                'key_moments': analysis_data.get('key_moments', []),
                'ai_summary': analysis_data.get('ai_summary'),
                'ai_title': analysis_data.get('ai_title'),
                'analyzed_at': datetime.now(timezone.utc).isoformat()
            }
            
            # Upsert based on session_id (unique constraint)
            self.supabase.table('analyzed_sessions').upsert(data, on_conflict='session_id').execute()
            return True
        except Exception as e:
            print(f"Error saving analyzed session: {e}")
            return False

    def get_emotion_timeline(self, user_id: str, days: int = 7):
        """Lấy dữ liệu biểu đồ cảm xúc từ analyzed_sessions."""
        try:
            # Calculate date range
            now = datetime.now(timezone.utc)
            start_date = now - timedelta(days=days)
            
            response = self.supabase.table('analyzed_sessions')\
                .select('emotion_score, analyzed_at, dominant_emotion')\
                .eq('user_id', user_id)\
                .gte('analyzed_at', start_date.isoformat())\
                .order('analyzed_at', desc=False)\
                .execute()
                
            return response.data if response.data else []
        except Exception as e:
            print(f"Error getting emotion timeline: {e}")
            return []
