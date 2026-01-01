# Reflection PWA - Quick Start Guide

## 🚀 Khởi động ứng dụng

### Cách 1: Sử dụng script (Khuyến nghị)
```bash
# Chạy script khởi động tự động
.\start_pwa.bat
```

Script sẽ tự động:
1. Kích hoạt virtual environment
2. Khởi động MCP Server (port 8020)
3. Khởi động PWA Server (port 8000)

### Cách 2: Khởi động thủ công

**Terminal 1 - MCP Server:**
```bash
.venv\Scripts\activate
python mcp_server.py
```

**Terminal 2 - PWA Server:**
```bash
.venv\Scripts\activate
python pwa_server.py
```

## 📱 Truy cập ứng dụng

Sau khi servers đã khởi động:

- **PWA Application:** http://localhost:8000/app
- **Chat Interface:** http://localhost:8000/app (trang chính)
- **Insights & Timeline:** http://localhost:8000/app/insights
- **Settings:** http://localhost:8000/app/settings
- **Therapist Connect:** http://localhost:8000/app/therapist-connect

## 🔧 API Endpoints

**Chat & Memory:**
- `WebSocket /ws/chat/{user_id}` - Real-time chat
- `GET /api/memories/{user_id}` - Lấy memories
- `POST /api/memory/save` - Lưu summary

**Moment Check-in:**
- `POST /api/moment` - Lưu check-in
- `GET /api/moments/{user_id}` - Lấy lịch sử

**Insights:**
- `GET /api/insights/emotions/{user_id}?days=7` - Dữ liệu biểu đồ
- `GET /api/insights/timeline/{user_id}` - Timeline conversations

**Therapist Mode:**
- `POST /api/therapist/pair` - Kích hoạt pairing code
- `GET /api/therapist/assignments/{user_id}` - Lấy bài tập

## 🎨 Tính năng chính

### 1. Chat với Bộ nhớ Dài hạn
- Trò chuyện real-time qua WebSocket
- AI tự động truy xuất ký ức liên quan
- Smart chips để trả lời nhanh
- Typing indicators

### 2. Moment Check-in
- Đánh giá cảm xúc 1-10
- Chọn context tags (#Công_việc, #Gia_đình...)
- Ghi chú nhanh
- Tự động lưu vào database

### 3. Insights & Hành trình
- Biểu đồ cảm xúc (7/30 ngày)
- Timeline cuộc trò chuyện
- Tóm tắt tuần

### 4. Therapist Connection
- Nhập pairing code
- Privacy consent
- Chia sẻ progress
- Xem assignments

### 5. Dark Mode
- Toggle giữa light/dark
- Lưu preference
- Consistent across all pages

## 📦 Cấu trúc dự án

```
memory_app/
├── pwa_server.py          # PWA backend server
├── mcp_server.py          # MCP server (existing)
├── database.py            # Database manager (existing)
├── pwa/                   # PWA frontend
│   ├── index.html         # Chat main page
│   ├── insights.html      # Insights & timeline
│   ├── settings.html      # Settings page
│   ├── therapist-connect.html  # Pairing page
│   ├── manifest.json      # PWA manifest
│   ├── service-worker.js  # Offline support
│   ├── css/
│   │   └── styles.css     # Global styles
│   ├── js/
│   │   ├── chat.js        # Chat logic
│   │   ├── moment-checkin.js  # Check-in modal
│   │   └── insights.js    # Visualization
│   └── images/
│       ├── icon-192.png
│       └── icon-512.png
└── start_pwa.bat          # Startup script
```

## 🧪 Testing

### Browser Console Tests

**Test WebSocket Connection:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/chat/test_user');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.send(JSON.stringify({message: 'Hello!'}));
```

**Test API:**
```javascript
// Get memories
fetch('http://localhost:8000/api/memories/test_user?query=công việc')
  .then(r => r.json())
  .then(console.log);
```

## 📱 PWA Installation

1. Mở http://localhost:8000/app trên Chrome/Edge
2. Click icon "Install" trong address bar
3. App sẽ cài đặt như native app
4. Mở từ Start Menu hoặc Desktop

## 🎯 Next Steps

1. **Test memory retrieval:** Chat và hỏi về quá khứ
2. **Try dark mode:** Toggle và kiểm tra consistency
3. **Create moment:** Click "✨ Check-in" chip
4. **View insights:** Navigate to Insights tab
5. **Test therapist mode:** Thử pairing code (mặc định chấp nhận mọi code)

## 🐛 Troubleshooting

**WebSocket không connect:**
- Kiểm tra PWA server đang chạy
- Refresh page
- Check console errors

**Memory không load:**
- Kiểm tra MCP server đang chạy
- Verify user_id trong localStorage
- Check database connection

**Dark mode không lưu:**
- Clear localStorage
- Refresh page
- Try toggle lại
