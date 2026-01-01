# 🚀 Deploy 2 Services riêng biệt lên Render

## Tại sao tách thành 2 services?

- ✅ Mỗi service tự quản lý port → Render detect được
- ✅ Logs riêng biệt → dễ debug
- ✅ Scale độc lập
- ✅ Restart riêng không ảnh hưởng nhau
- ✅ Free tier: 2 services x 512MB RAM

---

## 📋 Bước 1: Deploy MCP Server

### 1.1. Tạo Web Service cho MCP

1. Vào Render Dashboard: https://dashboard.render.com/
2. Click **"New +"** → **"Web Service"**
3. Connect repo: `reflection_deploy_render`
4. Cấu hình:

**Name**: `reflection-mcp-server`

**Region**: Singapore

**Branch**: `main`

**Build Command**: 
```bash
pip install -r requirements.txt
```

**Start Command**:
```bash
uvicorn mcp_server:app --host 0.0.0.0 --port $PORT
```

### 1.2. Environment Variables cho MCP

Click **"Advanced"** → Add:

| Key | Value |
|-----|-------|
| `GOOGLE_API_KEY` | `your_api_key` |
| `SUPABASE_URL` | `your_supabase_url` |
| `SUPABASE_KEY` | `your_supabase_key` |
| `USER_ID` | `user_demo` |
| `PYTHON_VERSION` | `3.11.0` |

### 1.3. Deploy

Click **"Create Web Service"**

Đợi build (~5 phút). Sau khi xong, bạn sẽ có URL:
```
https://reflection-mcp-server.onrender.com
```

**Copy URL này!** Cần dùng cho PWA server.

---

## 📋 Bước 2: Deploy PWA Server

### 2.1. Tạo Web Service cho PWA

1. Render Dashboard → **"New +"** → **"Web Service"**
2. Connect repo: `reflection_deploy_render`
3. Cấu hình:

**Name**: `reflection-pwa-server`

**Region**: Singapore

**Branch**: `main`

**Build Command**: 
```bash
pip install -r requirements.txt
```

**Start Command**:
```bash
uvicorn pwa_server:app --host 0.0.0.0 --port $PORT
```

### 2.2. Environment Variables cho PWA

Click **"Advanced"** → Add:

| Key | Value |
|-----|-------|
| `GOOGLE_API_KEY` | `your_api_key` |
| `SUPABASE_URL` | `your_supabase_url` |
| `SUPABASE_KEY` | `your_supabase_key` |
| `MCP_SERVER_URL` | `https://reflection-mcp-server.onrender.com/sse` |
| `USER_ID` | `user_demo` |
| `PYTHON_VERSION` | `3.11.0` |

⚠️ **QUAN TRỌNG**: `MCP_SERVER_URL` phải là URL thật của MCP server từ Bước 1!

### 2.3. Deploy

Click **"Create Web Service"**

Đợi build (~5 phút). URL PWA:
```
https://reflection-pwa-server.onrender.com
```

---

## 📋 Bước 3: Deploy Frontend (Static Site)

### 3.1. Tạo Static Site

1. Render Dashboard → **"New +"** → **"Static Site"**
2. Connect repo: `reflection_deploy_render`
3. Cấu hình:

**Name**: `reflection-frontend`

**Branch**: `main`

**Build Command**: 
```bash
echo "No build needed"
```

**Publish Directory**: 
```
pwa
```

### 3.2. Deploy

Click **"Create Static Site"**

URL frontend:
```
https://reflection-frontend.onrender.com
```

---

## 📋 Bước 4: Update config.js

Sau khi có URL backend thật, update `pwa/config.js`:

```javascript
case 'render':
  return 'https://reflection-pwa-server.onrender.com'; // ← URL thật
```

Commit và push:
```bash
git add pwa/config.js
git commit -m "Update backend URL for Render"
git push render main
```

Frontend sẽ tự động redeploy.

---

## ✅ Kiểm tra

### Test MCP Server
```bash
curl https://reflection-mcp-server.onrender.com/sse
```

### Test PWA Server
```bash
curl https://reflection-pwa-server.onrender.com/api/health
```

### Test Frontend
Mở: `https://reflection-frontend.onrender.com`

Kiểm tra Console (F12):
```
🌍 Environment: render
🔗 API URL: https://reflection-pwa-server.onrender.com
🔌 WebSocket URL: wss://reflection-pwa-server.onrender.com
```

---

## 🎯 Kết quả

**3 services đang chạy:**
1. **MCP Server**: `https://reflection-mcp-server.onrender.com`
2. **PWA Server**: `https://reflection-pwa-server.onrender.com`
3. **Frontend**: `https://reflection-frontend.onrender.com`

**Kiến trúc:**
```
Frontend (Static)
    ↓ API calls
PWA Server (Python)
    ↓ MCP calls
MCP Server (Python)
    ↓
Supabase (Database)
```

---

## 💡 Tips

- **Free tier sleep**: Services ngủ sau 15 phút không dùng
- **Wake up**: Mất ~30 giây để wake up
- **Logs**: Xem logs riêng cho từng service
- **Restart**: Restart từng service độc lập

Hoàn thành! 🎉
