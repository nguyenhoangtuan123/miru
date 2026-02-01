# Báo Cáo Audit Bảo Mật Hệ Thống Miru

**Ngày audit:** 2026-01-30  
**Người thực hiện:** Security Audit  
**Phiên bản:** 1.0

---

## 📋 Tóm Tắt Điều Hành

Hệ thống Miru là một ứng dụng chat tâm lý với AI hỗ trợ. Audit này đã đánh giá toàn bộ luồng dữ liệu và phát hiện **nhiều vấn đề bảo mật nghiêm trọng** cần được khắc phục ngay lập tức.

### Mức Độ Rủi Ro Tổng Thể: 🔴 **CAO**

---

## 🚨 Vấn Đề Nghiêm Trọng (Cần Khắc Phục Ngay)

### 1. Sensitive Data Exposure trong .env

**Địa vị:** [`.env`](.env:1-40)  
**Mức độ:** 🔴 CRITICAL

**Mô tả:** File `.env` chứa các credentials thực sự đã bị commit vào repository:

```
SUPABASE_URL="https://cdnjhuvknsyasjvpcgrz.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS..."
GOOGLE_API_KEY="AIzaSyDGlR0Q4jHJTDyemG05WGYNObS3BzJzWJU"
GROQ_API_KEY="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"
SUPABASE_DB_URL="postgresql://postgres.cdnjhuvknsyasjvpcgrz:0569907145abc@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres"
JWT_SECRET_KEY=8e8110938df74f837e2ecaa3dff9070a9248ccad52786f9dc10acd625f88df52
GOOGLE_CLIENT_SECRET=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
```

**Nguy cơ:**
- Attacker có thể truy cập vào Supabase database
- Attacker có thể sử dụng Google API và Groq API
- Attacker có thể giả mạo JWT tokens
- Database credentials (username/password) bị lộ rõ ràng

**Hành động khắc phục:**
1. **Ngay lập tức:** Rotate tất cả các API keys và credentials đã bị lộ
2. Thêm `.env` vào `.gitignore` (kiểm tra xem đã có chưa)
3. Xóa credentials khỏi repository history bằng `git filter-branch` hoặc BFG Repo-Cleaner
4. Sử dụng secrets management service (AWS Secrets Manager, HashiCorp Vault) cho production
5. Tạo `.env.example` với placeholder values

---

### 2. Session Token Security Yếu

**Địa vị:** [`auth_manager.py:100-120`](auth_manager.py:100)  
**Mức độ:** 🔴 HIGH

**Mô tả:** Hệ thống sử dụng session token đơn giản với base64 encode:

```python
def create_session_token(self, user_id: str):
    timestamp = datetime.now(timezone.utc).isoformat()
    random_str = secrets.token_urlsafe(32)
    token_data = f"{user_id}:{timestamp}:{random_str}"
    token = base64.b64encode(token_data.encode()).decode()  # Dễ dàng decode!
    return token
```

**Nguy cơ:**
- Token có thể easily decode để lấy user_id
- Không có signature để verify token integrity
- Attacker có thể tạo token giả nếu biết format

**Hành động khắc phục:**
1. Thay thế bằng proper JWT tokens với HS256 signature
2. Hoặc sử dụng `itsdangerous` library cho session signing
3. Thêm token rotation và revocation mechanism

---

### 3. WebSocket Authentication Thiếu

**Địa vị:** [`routers/chat.py:190-191`](routers/chat.py:190)  
**Mức độ:** 🔴 HIGH

**Mô tả:** WebSocket endpoint chỉ nhận `user_id` từ URL mà không xác thực:

```python
@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    await websocket.accept()  # Không xác thực!
```

**Nguy cơ:**
- Bất kỳ ai cũng có thể kết nối WebSocket với bất kỳ user_id nào
- Truy cập vào tin nhắn của user khác
- Có thể inject messages thay mặt user

**Hành động khắc phục:**
1. Implement WebSocket authentication với token
2. Validate user_id từ token với user_id trong URL
3. Sử dụng `websocket` parameter trong `auth_middleware`

---

## ⚠️ Vấn Đề Cao (Cần Khắc Phục Sớm)

### 4. JWT Secret Key Default Value

**Địa vị:** [`auth.py:14-29`](auth.py:14)  
**Mức độ:** 🟠 HIGH

**Mô tả:** JWT_SECRET_KEY có giá trị mặc định không an toàn:

```python
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
```

**Hành động khắc phục:**
1. Raise exception thay vì warning nếu secret key là default
2. Kiểm tra entropy của secret key
3. Enforce strong secret key trong production

---

### 5. Database Connection String Logging

**Địa vị:** [`database.py:40`](database.py:40)  
**Mức độ:** 🟠 MEDIUM

**Mô tả:** Connection string được log ra (dù có mask password):

```python
print(f"DEBUG: Connecting to Supabase URL: '{url}'")
```

**Hành động khắc phục:**
1. Không log URL hoặc connection strings
2. Sử dụng structured logging với PII masking

---

### 6. SSL Verification Disable Option

**Địa vị:** [`database.py:15`](database.py:15)  
**Mức độ:** 🟠 MEDIUM

**Mô tả:** Comment về việc disable SSL verification:

```python
# ssl._create_default_https_context = ssl._create_unverified_context  # Disabled for Railway
```

**Hành động khắc phục:**
1. Đảm bảo SSL verification luôn được enable trong production
2. Sử dụng proper SSL certificates thay vì bypass

---

### 7. Cookie Security Configuration

**Địa vị:** [`auth_middleware.py:109-116`](auth_middleware.py:109)  
**Mức độ:** 🟠 MEDIUM

**Mô tả:** Cookie configuration với `samesite="none"`:

```python
return {
    "key": "access_token",
    "value": token,
    "httponly": True,
    "samesite": "none" if is_production else "lax",
    "secure": is_production,
}
```

**Nguy cơ:** `samesite="none"` yêu cầu `secure=true` (đã có) nhưng vẫn có thể bị CSRF attacks trong một số trường hợp.

**Hành động khắc phục:**
1. Xem xét sử dụng `samesite="strict"` nếu không có cross-origin requirements
2. Implement thêm CSRF tokens cho sensitive operations

---

## 📊 Vấn Đề Trung Bình (Cần Cải Thiện)

### 8. Input Validation Thiếu trong Một Số Endpoints

**Địa vị:** [`routers/chat.py:22-52`](routers/chat.py:22)  
**Mức độ:** 🟡 MEDIUM

**Một số endpoints không có validation đầy đủ:**

```python
@router.get("/api/chat/sessions/{user_id}")
async def get_chat_sessions(user_id: str, limit: int = 20):
    # user_id không được validate (có thể chứa special characters)
    # limit không có upper bound
```

**Hành động khắc phục:**
1. Thêm input validation với Pydantic models
2. Limit các numeric parameters
3. Sanitize string inputs

---

### 9. Rate Limiting Thiếu

**Mức độ:** 🟡 MEDIUM

**Mô tả:** Hệ thống không có rate limiting cho API endpoints.

**Nguy cơ:**
- Brute force attacks
- DoS attacks
- API abuse

**Hành động khắc phục:**
1. Implement rate limiting với `slowapi` hoặc `fastapi-limiter`
2. Áp dụng different limits cho different endpoints
3. Add rate limit headers vào responses

---

### 10. Error Messages Có Thể Reveal Information

**Địa vị:** [`auth.py:72`](auth.py:72)  
**Mức độ:** 🟡 LOW

**Mô tả:** Error messages có thể reveal thông tin về hệ thống:

```python
except InvalidTokenError as e:
    print(f"Token verification failed: {e}")
```

**Hành động khắc phục:**
1. Sanitize error messages trong production
2. Log chi tiết phía server nhưng trả về generic messages cho client

---

## ✅ Điểm Tốt Của Hệ Thống

1. **httponly Cookie:** Đã được implement đúng để prevent XSS
2. **Secure Cookie:** Đã được enable trong production
3. **Password Hashing:** Không lưu password (sử dụng Google OAuth)
4. **Crisis Detection:** Có module phát hiện khủng hoảng tâm lý
5. **Privacy Settings:** Có GDPR-compliant features (data export, deletion)
6. **Audit Trail:** Có logging cho các hoạt động quan trọng

---

## 🔄 Luồng Dữ Liệu Đã Đánh Giá

```mermaid
flowchart TB
    subgraph Client [Client Side]
        PWA[PWA Frontend]
        WS[WebSocket]
        LS[LocalStorage]
    end
    
    subgraph Backend [Backend Server]
        Auth[Auth Middleware]
        API[API Routes]
        WSHandler[WebSocket Handler]
    end
    
    subgraph Services [Services]
        Chat[Chat Manager]
        Memory[Memory Service]
        Crisis[Crisis Detector]
    end
    
    subgraph External [External Services]
        Google[Google OAuth/API]
        Supabase[(Supabase DB)]
        Groq[Groq AI]
        Mem0[Mem0 Service]
    end
    
    PWA -->|HTTP Requests| API
    PWA -->|WebSocket| WSHandler
    PWA -->|Store Token| LS
    
    API --> Auth
    WSHandler --> Auth
    
    Auth -->|Verified User| Chat
    Auth -->|Verified User| Memory
    
    Chat --> Crisis
    Chat --> Supabase
    Memory --> Mem0
    
    API --> Supabase
    
    note["⚠️ Sensitive Data Exposure: .env file
         ⚠️ WebSocket Auth Missing
         ⚠️ Session Token Weak"]
```

---

## 📝 Danh Sách Hành Động Theo Ưu Tiên

### 🔴 Priority 1 - Ngay Lập Tức (Trong 24h)

| # | Hành động | Files | Trạng thái |
|---|-----------|-------|------------|
| 1 | Rotate tất cả API keys và credentials | `.env` | ⬜ Chưa làm |
| 2 | Thêm `.env` vào `.gitignore` | `.gitignore` | ⬜ Kiểm tra |
| 3 | Xóa credentials khỏi git history | All | ⬜ Chưa làm |
| 4 | Implement WebSocket authentication | `routers/chat.py` | ⬜ Chưa làm |

### 🟠 Priority 2 - Trong Tuần

| # | Hành động | Files | Trạng thái |
|---|-----------|-------|------------|
| 5 | Thay thế session token bằng JWT | `auth_manager.py` | ⬜ Chưa làm |
| 6 | Enforce JWT secret key validation | `auth.py` | ⬜ Chưa làm |
| 7 | Implement rate limiting | `main.py` | ⬜ Chưa làm |
| 8 | Thêm input validation cho endpoints | `routers/*.py` | ⬜ Chưa làm |

### 🟡 Priority 3 - Trong Tháng

| # | Hành động | Files | Trạng thái |
|---|-----------|-------|------------|
| 9 | Review và improve error handling | All | ⬜ Chưa làm |
| 10 | Implement CSRF protection | `auth_middleware.py` | ⬜ Chưa làm |
| 11 | Security headers (CSP, HSTS) | `main.py` | ⬜ Chưa làm |
| 12 | Audit third-party dependencies | `requirements.txt` | ⬜ Chưa làm |

---

## 📚 Tài Liệu Tham Khảo

- [OWASP Top 10 2021](https://owasp.org/Top10/)
- [FastAPI Security Best Practices](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [Supabase Security](https://supabase.com/docs/guides/security)

---

## 📝 Kết Luận

Hệ thống Miru có một số điểm mạnh về bảo mật (sử dụng OAuth, cookie security), tuy nhiên có **nhiều vấn đề nghiêm trọng** cần được khắc phục ngay, đặc biệt là việc exposure sensitive credentials trong `.env` file và thiếu authentication cho WebSocket.

**Khuyến nghị:** Dừng deployment hiện tại, rotate tất cả credentials, khắc phục các vấn đề Priority 1, sau đó mới tiếp tục vận hành hệ thống.

---

*Báo cáo này được tạo bởi Security Audit Mode - Miru Project*
