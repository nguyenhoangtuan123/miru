# Memory App Project

Hệ thống AI Chatbot với bộ nhớ dài hạn (Long-term Memory) sử dụng MCP (Model Context Protocol), Supabase và Google Gemini.

## 🚀 Cách khởi động

Bạn cần mở **2 terminal** riêng biệt để chạy hệ thống:

### Terminal 1: Chạy Server
Server chịu trách nhiệm xử lý API, chat, memory và kết nối Database.
```powershell
.venv\Scripts\activate
uvicorn app:app --app-dir src --host 0.0.0.0 --port 8008
```
_Chờ đến khi thấy backend chạy tại `http://127.0.0.1:8008`._

### Terminal 2: Chạy Client
Client là giao diện chat để bạn tương tác với AI.
```powershell
cd UI_new\miru_ggstudio-main
npm run dev
```

## 📂 Cấu trúc dự án
- `src/app.py`: Server chính (FastAPI).
- `UI_new/miru_ggstudio-main/`: Frontend Vite + React.
- `database.py`: Quản lý kết nối Supabase và Vector Search.
- `.env`: Cấu hình API Key và Database URL.
"# reflection_project" 
