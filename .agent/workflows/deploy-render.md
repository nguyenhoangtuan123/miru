---
description: Deploy PWA to Render (Phase 1)
---

# 🚀 Deploy PWA lên Render - Phase 1

Hướng dẫn deploy ứng dụng PWA lên Render với 2 services riêng biệt (backend + frontend).

## 📋 Chuẩn bị

### 1. Tạo tài khoản Render
- Truy cập: https://render.com/
- Sign up bằng GitHub (khuyên dùng)

### 2. Push code lên GitHub

```bash
# Kiểm tra status
git status

# Add tất cả files mới
git add .

# Commit
git commit -m "Add Render deployment config"

# Push
git push origin main
```

## 🔧 Bước 1: Deploy Backend Service

### 1.1. Tạo Web Service

1. Vào Render Dashboard → **New** → **Web Service**
2. Connect GitHub repository `memory_app`
3. Cấu hình:
   - **Name**: `reflection-backend`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python start_servers.py`

### 1.2. Thiết lập Environment Variables

Click **Advanced** → **Add Environment Variable**:

| Key | Value |
|-----|-------|
| `GOOGLE_API_KEY` | `your_google_api_key_here` |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `SUPABASE_KEY` | `your_supabase_anon_key` |
| `MCP_SERVER_URL` | `http://localhost:8020/sse` |
| `USER_ID` | `user_demo` |
| `PORT` | `8000` |
| `PYTHON_VERSION` | `3.11.0` |

> **Lấy credentials từ đâu?**
> - `GOOGLE_API_KEY`: https://aistudio.google.com/app/apikey
> - `SUPABASE_URL` & `SUPABASE_KEY`: Supabase Dashboard → Settings → API

### 1.3. Deploy

- Click **Create Web Service**
- Đợi 5-10 phút để build và deploy
- Sau khi deploy xong, bạn sẽ có URL: `https://reflection-backend.onrender.com`

### 1.4. Kiểm tra Backend

```bash
curl https://reflection-backend.onrender.com/api/health
```

Kết quả mong đợi:
```json
{
  "status": "healthy",
  "timestamp": "...",
  "database": "connected"
}
```

## 🌐 Bước 2: Deploy Frontend Service

### 2.1. Cập nhật config.js

**QUAN TRỌNG**: Trước khi deploy frontend, cập nhật backend URL trong `pwa/config.js`:

```javascript
case 'render':
  return 'https://reflection-backend.onrender.com'; // ← Thay bằng URL thật của bạn
```

Commit và push:
```bash
git add pwa/config.js
git commit -m "Update backend URL"
git push
```

### 2.2. Tạo Static Site

1. Render Dashboard → **New** → **Static Site**
2. Connect repository `memory_app`
3. Cấu hình:
   - **Name**: `reflection-frontend`
   - **Region**: Singapore
   - **Branch**: `main`
   - **Build Command**: `echo "No build needed"`
   - **Publish Directory**: `pwa`

### 2.3. Deploy

- Click **Create Static Site**
- Đợi 2-3 phút
- URL frontend: `https://reflection-frontend.onrender.com`

## ✅ Bước 3: Kiểm tra PWA

### 3.1. Mở ứng dụng

Truy cập: `https://reflection-frontend.onrender.com`

### 3.2. Test các tính năng

**Landing Page**
- ✅ Hiển thị đúng
- ✅ Hình ảnh load được

**Đăng nhập**
- ✅ Google Login hoạt động
- ✅ Redirect đến `/app`

**Chat**
- ✅ WebSocket kết nối
- ✅ Gửi tin nhắn
- ✅ AI phản hồi
- ✅ Lưu conversation

**PWA Installation**
- **Desktop**: Nhìn thanh địa chỉ, có icon install
- **Mobile**: Menu → "Add to Home Screen"

### 3.3. Kiểm tra Console

Mở DevTools (F12) → Console, xem:
```
🌍 Environment: render
🔗 API URL: https://reflection-backend.onrender.com
🔌 WebSocket URL: wss://reflection-backend.onrender.com
🔌 Connecting to: wss://reflection-backend.onrender.com/ws/chat/user_xxx
✅ WebSocket connected
```

## 🐛 Troubleshooting

### Lỗi: Backend "Service Unavailable"

**Nguyên nhân**: Free tier ngủ sau 15 phút không dùng

**Giải pháp**: Đợi 30-60 giây, backend sẽ tự wake up

### Lỗi: WebSocket không kết nối

**Kiểm tra**:
1. Backend có chạy không? → Test `/api/health`
2. URL trong `config.js` đúng chưa?
3. Console có lỗi CORS không?

**Giải pháp**: Xem logs backend trên Render Dashboard

### Lỗi: "Failed to fetch"

**Nguyên nhân**: CORS hoặc backend chưa sẵn sàng

**Giải pháp**:
1. Kiểm tra backend URL trong `config.js`
2. Xem logs backend
3. Test API trực tiếp bằng `curl`

### PWA không cài đặt được

**Kiểm tra**:
1. HTTPS có hoạt động không? (Render tự động có)
2. `manifest.json` accessible? → Test `/manifest.json`
3. `service-worker.js` có lỗi không? → DevTools → Application → Service Workers

## 📊 Monitoring

### Xem Logs

**Backend**:
- Render Dashboard → `reflection-backend` → Logs

**Frontend**:
- Render Dashboard → `reflection-frontend` → Logs

### Metrics

- Render Dashboard → service → Metrics
- Xem: CPU, Memory, Response Time

## 🔄 Cập nhật sau này

Mỗi khi sửa code:

```bash
git add .
git commit -m "Your changes"
git push
```

Render sẽ **tự động deploy lại** (CI/CD).

## 💡 Tips

### Giữ Backend không ngủ (Optional)

Dùng cron job ping mỗi 10 phút:

1. Tạo account trên https://cron-job.org
2. Thêm job:
   - URL: `https://reflection-backend.onrender.com/api/health`
   - Interval: Every 10 minutes

### Custom Domain (Optional)

1. Render Dashboard → service → Settings → Custom Domain
2. Thêm domain của bạn
3. Cập nhật DNS records

## 🎯 Next Steps

Sau khi test xong trên Render:

- [ ] Verify tất cả tính năng hoạt động
- [ ] Test PWA installation
- [ ] Test trên mobile
- [ ] Sẵn sàng cho Phase 2: Migrate frontend sang Vercel

---

**Hoàn thành Phase 1!** 🎉

Bây giờ bạn có:
- ✅ Backend chạy trên Render
- ✅ Frontend chạy trên Render
- ✅ PWA có thể cài đặt
- ✅ WebSocket hoạt động

Sẵn sàng cho Phase 2 khi muốn! 🚀
