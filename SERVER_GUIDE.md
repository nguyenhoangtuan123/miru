# Hướng dẫn Khởi động PWA - QUAN TRỌNG

## ❓ Tôi cần chạy `run.bat` không?

**KHÔNG!** Để chạy PWA, bạn cần khởi động theo cách MỚI:

### 🔴 Cách CŨ (Desktop Client - KHÔNG dùng cho PWA)
```bash
.\run.bat  # Chạy mcp_server.py + client_time.py (desktop)
```

### ✅ Cách MỚI (PWA - ĐÚNG CÁCH)
```bash
.\start_pwa.bat  # Chạy mcp_server.py + pwa_server.py (PWA)
```

## 📋 Các bước khởi động ĐÚNG

### Bước 1: Dừng servers cũ (NẾU đang chạy)

Nếu bạn đang chạy `run.bat` hoặc `pwa_server.py` riêng rẽ, hãy **tắt tất cả**:

1. Tìm các terminal windows có chữ "MCP Server" hoặc "PWA Server"
2. Nhấn `Ctrl+C` trong mỗi terminal để dừng
3. Đóng các terminal đó

### Bước 2: Khởi động servers mới

```bash
# Mở 1 terminal mới
.\start_pwa.bat
```

Script sẽ tự động:
- ✅ Kích hoạt virtual environment (.venv)
- ✅ Khởi động **MCP Server** (port 8020) - Cho bộ nhớ và database
- ✅ Khởi động **PWA Server** (port 8000) - Cho web interface

### Bước 3: Truy cập PWA

Mở browser tại: **http://localhost:8000app**

---

## 🔧 Tại sao cần cả 2 servers?

### 1. **MCP Server** (port 8020)
- Quản lý bộ nhớ dài hạn (memories)
- Kết nối với Supabase database
- Cung cấp các tools: `find_relevant_memories`, `add_session_summary`, etc.
- **MCP Server phải chạy TRƯỚC**

### 2. **PWA Server** (port 8000)
- Phục vụ giao diện web (HTML/CSS/JS)
- WebSocket endpoint cho chat real-time
- REST API endpoints (`/api/*`)
- Gọi MCP Server khi cần truy xuất memories
- **PWA Server phải có MCP Server để hoạt động đầy đủ**

---

## 🆚 So sánh: Desktop Client vs PWA

| Tính năng | Desktop Client (`run.bat`) | PWA (`start_pwa.bat`) |
|-----------|---------------------------|----------------------|
| Giao diện | Terminal/CMD | Web Browser |
| Chat | `client_time.py` | `pwa/index.html` |
| Server port | MCP: 8020 | MCP: 8020 + PWA: 8000 |
| Memory | ✅ Có | ✅ Có |
| Dark mode | ❌ Không | ✅ Có |
| Insights chart | ❌ Không | ✅ Có |
| Moment check-in | ❌ Không | ✅ Có |
| Therapist mode | ❌ Không | ✅ Có |
| PWA install | ❌ Không | ✅ Có |

---

## ⚠️ Lỗi thường gặp

### Lỗi: WebSocket không connect
```
❌ WebSocket error: Connection refused
```
**Nguyên nhân:** PWA Server chưa chạy  
**Giải pháp:** Chạy `.\start_pwa.bat`

### Lỗi: Memory không load
```
[MCP Error] find_relevant_memories: Connection refused
```
**Nguyên nhân:** MCP Server chưa chạy  
**Giải pháp:** Chạy `.\start_pwa.bat` (sẽ tự động chạy cả 2 servers)

### Lỗi: Database connection failed
```
SUPABASE_URL và SUPABASE_KEY phải được thiết lập
```
**Nguyên nhân:** File `.env` chưa cấu hình  
**Giải pháp:** Kiểm tra file `.env` có đầy đủ:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
GOOGLE_API_KEY=your-gemini-key
```

---

## 🎯 TÓM TẮT NHANH

```bash
# ❌ KHÔNG chạy
.\run.bat

# ✅ CHẠY cái này
.\start_pwa.bat

# Sau đó mở browser:
http://localhost:8000/app
```

Xong! 🎉
