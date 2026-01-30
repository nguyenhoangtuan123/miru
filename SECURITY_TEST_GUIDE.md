# Hướng dẫn kiểm tra bảo mật Miru

## Cách 1: Chạy script tự động (khuyên dùng)

```bash
cd D:\miru_-main
python test_security.py
```

**Kết quả mong đợi:**
- `[PASS]` cho tất cả các test
- `[SUCCESS] All security tests passed!`

## Cách 2: Test thủ công qua DevTools

### Bước 1: Mở DevTools
- Nhấn `F12` hoặc `Ctrl+Shift+I`
- Chuyển sang tab **Console**

### Bước 2: Kiểm tra unauthorized access
```javascript
// Thử gọi API không có token
fetch('http://localhost:8008/api/chat/sessions/test_user_id')
  .then(r => console.log('Status:', r.status))
  .catch(e => console.log('Error:', e))

// Mong đợi: Status 401 hoặc 403
```

### Bước 3: Kiểm tra IDOR (đọc data user khác)
```javascript
// Login với user A
// Sau đó thử đọc data của user B
fetch('http://localhost:8008/api/chat/sessions/USER_B_ID', {
  credentials: 'include'
})
.then(r => console.log('IDOR Test - Status:', r.status))

// Mong đợi: Status 403 (Forbidden)
```

### Bước 4: Kiểm tra SQL Injection
```javascript
// Thử SQL injection qua user_id
fetch('http://localhost:8008/api/chat/sessions/1%27%20OR%20%271%27=%271')
  .then(r => console.log('SQLi Test - Status:', r.status))

// Mong đợi: Status 401/403/404 (không được 200)
```

### Bước 5: Kiểm tra WebSocket security
```javascript
// Thử kết nối WS với user_id khác
const ws = new WebSocket('ws://localhost:8008/ws/chat/OTHER_USER_ID')
ws.onerror = (e) => console.log('WS Error (expected):', e)
ws.onclose = (e) => console.log('WS Close code:', e.code)

// Mong đợi: Close code 1008 hoặc không kết nối được
```

## Các dấu hiệu bảo mật tốt

| Test | Kết quả tốt | Kết quả xấu |
|------|-------------|-------------|
| API không token | 401/403 | 200 với data |
| IDOR (đọc user khác) | 403 | 200 với data |
| SQL Injection | 401/403/404 | 200 với data |
| WebSocket sai user | Không kết nối được | Kết nối thành công |

## Nếu test fail

Nếu bất kỳ test nào trả về **200 OK với data**, điều đó nghĩa là:
- ❌ API đang lộ data
- ❌ User có thể đọc data của user khác
- ❌ Cần kiểm tra lại auth middleware

## Liên hệ

Nếu phát hiện lỗ hổng bảo mật, hãy báo ngay!