# Memory App Project

Hệ thống AI Chatbot với bộ nhớ dài hạn (Long-term Memory) sử dụng MCP (Model Context Protocol), Supabase và Google Gemini.

## 🚀 Cách khởi động

Bạn cần mở **2 terminal** riêng biệt để chạy hệ thống:

### Terminal 1: Chạy Server
Server chịu trách nhiệm xử lý bộ nhớ và kết nối Database.
```powershell
.venv\Scripts\activate
python mcp_server.py
```
_Chờ đến khi thấy thông báo server đang chạy tại `http://127.0.0.1:8020`._

### Terminal 2: Chạy Client
Client là giao diện chat để bạn tương tác với AI.
```powershell
.venv\Scripts\activate
python client_time.py
```

## 📂 Cấu trúc dự án
- `mcp_server.py`: Server chính (FastAPI + MCP).
- `client_time.py`: Client chat (Gemini + MCP Client).
- `database.py`: Quản lý kết nối Supabase và Vector Search.
- `.env`: Cấu hình API Key và Database URL.
"# reflection_project" 
