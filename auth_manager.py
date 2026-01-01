try:
    import certifi
    import os
    os.environ['SSL_CERT_FILE'] = certifi.where()
except Exception as e:
    # Railway has SSL certs configured, certifi not needed
    print(f"Skipping certifi config: {e}")

from datetime import datetime, timezone
from database import DatabaseManager

class AuthManager:
    """
    Quản lý các chức năng liên quan đến Authentication.
    Module này hoạt động độc lập bên cạnh DatabaseManager.
    """
    
    def __init__(self):
        # Sử dụng lại instance của DatabaseManager
        self.db_manager = DatabaseManager()

    def logout(self, user_id: str):
        """
        Xử lý logout cho user.
        Frontend sẽ xóa localStorage và redirect.
        """
        try:
            # NOTE: Không ghi log vào DB vì schema users.id hiện tại là BIGINT
            # trong khi user_id (Google ID) là TEXT, gây lỗi type mismatch
            # Logout vẫn hoạt động bình thường ở frontend
            
            print(f"✅ User {user_id} đã logout thành công")
            
            return {
                "success": True,
                "message": "Đăng xuất thành công"
            }
            
        except Exception as e:
            print(f"❌ Lỗi khi logout user {user_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    def get_user_info(self, user_id: str):
        """Lấy thông tin user (tùy chọn, để mở rộng sau)"""
        try:
            user = self.db_manager.get_or_create_user(user_id)
            return {
                "success": True,
                "user": user
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def login_google(self, google_id: str, email: str, name: str, picture: str = None):
        """
        Đăng nhập bằng Google OAuth.
        Tự động tạo user nếu chưa có.
        Trả về session token (expire 14 ngày).
        """
        try:
            print(f"🔍 DEBUG: Starting login_google for {google_id}")
            
            # Get or create user
            print(f"🔍 DEBUG: Calling get_or_create_user...")
            user = self.db_manager.get_or_create_user(google_id, name)
            print(f"🔍 DEBUG: get_or_create_user completed: {user}")
            
            # Create session token
            print(f"🔍 DEBUG: Creating session token...")
            session_token = self.create_session_token(google_id)
            print(f"🔍 DEBUG: Session token created")
            
            print(f"✅ User {name} ({google_id}) đã đăng nhập thành công")
            
            return {
                "success": True,
                "session_token": session_token,
                "user_id": google_id,
                "user_name": name,
                "user_email": email,
                "user_picture": picture
            }
            
        except Exception as e:
            import traceback
            print(f"❌ Lỗi khi đăng nhập Google: {str(e)}")
            print(f"🔍 DEBUG: Full traceback:")
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e)
            }

    def create_session_token(self, user_id: str):
        """
        Tạo session token cho user.
        Token = base64(user_id:timestamp:random)
        Expire sau 14 ngày.
        """
        import base64
        import secrets
        from datetime import datetime, timedelta, timezone
        
        # Tạo token
        timestamp = datetime.now(timezone.utc).isoformat()
        random_str = secrets.token_urlsafe(32)
        token_data = f"{user_id}:{timestamp}:{random_str}"
        token = base64.b64encode(token_data.encode()).decode()
        
        # Lưu vào memory (hoặc có thể lưu vào DB nếu cần)
        # Ở đây đơn giản, chỉ encode user_id vào token
        # Frontend sẽ lưu token và gửi lại mỗi request
        
        return token

    def verify_session(self, token: str):
        """
        Verify session token.
        Check xem token có hợp lệ và chưa expire không.
        """
        try:
            import base64
            from datetime import datetime, timedelta, timezone
            
            # Decode token
            token_data = base64.b64decode(token.encode()).decode()
            parts = token_data.split(':')
            
            if len(parts) != 3:
                return {"valid": False, "error": "Invalid token format"}
            
            user_id, timestamp_str, _ = parts
            
            # Check expiry (14 ngày)
            token_time = datetime.fromisoformat(timestamp_str)
            now = datetime.now(timezone.utc)
            expiry_time = token_time + timedelta(days=14)
            
            if now > expiry_time:
                return {"valid": False, "error": "Token expired"}
            
            return {
                "valid": True,
                "user_id": user_id
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e)
            }

