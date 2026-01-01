---
description: Deploy Backend to Railway
---

# 🚀 Deploy Backend to Railway

Hướng dẫn deploy PWA backend lên Railway (hỗ trợ WebSocket).

// turbo-all

## 📋 Yêu cầu

1. **Tài khoản Railway**: https://railway.app (có thể dùng GitHub login)
2. **Git repository** đã push lên GitHub

## 🔧 Bước 1: Tạo Project trên Railway

1. Truy cập: https://railway.app/new
2. Click **"Deploy from GitHub repo"**
3. Chọn repository `memory_app`
4. Railway tự động detect Python và build

## 🔧 Bước 2: Cấu hình Environment Variables

Vào **Settings → Variables** và thêm:

| Key | Value |
|-----|-------|
| `GROQ_API_KEY` | `your_groq_api_key` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` |
| `SUPABASE_URL` | `your_supabase_url` |
| `SUPABASE_KEY` | `your_supabase_key` |
| `MCP_SERVER_URL` | `http://localhost:8020/sse` |
| `GOOGLE_API_KEY` | `your_google_api_key` (nếu dùng embeddings) |

## 🔧 Bước 3: Cấu hình Start Command

Vào **Settings → Deploy**:

- **Start Command**: `uvicorn pwa_server:app --host 0.0.0.0 --port $PORT`
- **Healthcheck Path**: `/api/health`

## 🔧 Bước 4: Deploy

Click **"Deploy"** và đợi build (~2-3 phút).

Sau khi xong, bạn sẽ có URL:
```
https://YOUR_APP.up.railway.app
```

## 🔧 Bước 5: Update Frontend Config

Sau khi có Railway URL:

1. Mở file `pwa/config.js`
2. Thay `YOUR_APP` bằng URL thật:
   ```javascript
   case 'vercel':
       return 'https://reflection-backend.up.railway.app';
   case 'railway':
       return 'https://reflection-backend.up.railway.app';
   ```
3. Commit và push

## ✅ Kiểm tra

```bash
# Test health endpoint
curl https://YOUR_APP.up.railway.app/api/health

# Test WebSocket (cần wscat)
wscat -c wss://YOUR_APP.up.railway.app/ws/chat/test_user
```

## 💡 Notes

- Railway cho 500 giờ free mỗi tháng
- Hỗ trợ WebSocket persistent connections
- Logs: **Dashboard → Deployments → Logs**
