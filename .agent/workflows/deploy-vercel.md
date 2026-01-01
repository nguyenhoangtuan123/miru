---
description: Deploy PWA to Vercel
---

# 🚀 Deploy PWA Application to Vercel

Hướng dẫn deploy ứng dụng PWA (Progressive Web App) lên Vercel để test và demo.

## ⚠️ Lưu ý quan trọng

**Vercel Serverless Functions có một số giới hạn:**
- ⏱️ **Timeout**: 10 giây (Hobby plan) / 60 giây (Pro plan)
- 💾 **Memory**: 1024 MB
- 📦 **Size**: 50 MB per function
- 🚫 **WebSocket**: Không hỗ trợ persistent WebSocket connections

**Do đó, một số tính năng có thể cần điều chỉnh:**
- WebSocket chat (`/ws/chat`) sẽ cần chuyển sang HTTP polling hoặc SSE
- MCP Server cần deploy riêng (hoặc sử dụng external service)

## 📋 Yêu cầu trước khi bắt đầu

1. **Tài khoản Vercel** (miễn phí): https://vercel.com/signup
2. **Git repository** (GitHub/GitLab/Bitbucket)
3. **Supabase** đã setup và có credentials
4. **Google API Key** cho Gemini AI

## 🔧 Bước 1: Chuẩn bị Project

### 1.1. Kiểm tra file cấu hình

Đảm bảo các file sau đã được tạo:
- ✅ `vercel.json` - Cấu hình Vercel
- ✅ `.vercelignore` - Loại trừ file không cần
- ✅ `requirements.txt` - Python dependencies

### 1.2. Commit code lên Git

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

> **Lưu ý**: Đảm bảo file `.env` KHÔNG được commit (đã có trong `.gitignore`)

## 🌐 Bước 2: Deploy lên Vercel

### 2.1. Import Project

1. Truy cập https://vercel.com/new
2. Chọn **Import Git Repository**
3. Chọn repository `memory_app` của bạn
4. Click **Import**

### 2.2. Cấu hình Project

**Framework Preset**: Other (Vercel sẽ tự detect Python)

**Root Directory**: `.` (để trống)

**Build Command**: Để trống (không cần build)

**Output Directory**: Để trống

### 2.3. Thiết lập Environment Variables

Click **Environment Variables** và thêm các biến sau:

| Key | Value | Nguồn |
|-----|-------|-------|
| `GOOGLE_API_KEY` | `your_google_api_key` | Google AI Studio |
| `SUPABASE_URL` | `https://xxx.supabase.co` | Supabase Dashboard |
| `SUPABASE_KEY` | `your_supabase_anon_key` | Supabase Dashboard |
| `MCP_SERVER_URL` | `http://localhost:8020/sse` | Tạm thời để localhost |
| `USER_ID` | `user_demo` | Default user ID |

> **Quan trọng**: Copy chính xác từ file `.env` local của bạn

### 2.4. Deploy

Click **Deploy** và đợi khoảng 1-2 phút.

## ✅ Bước 3: Kiểm tra Deployment

### 3.1. Kiểm tra Health Endpoint

Sau khi deploy xong, Vercel sẽ cung cấp URL (ví dụ: `https://memory-app-xxx.vercel.app`)

Test health endpoint:
```bash
curl https://your-app.vercel.app/api/health
```

Kết quả mong đợi:
```json
{
  "status": "healthy",
  "timestamp": "2024-11-28T01:30:00+07:00",
  "database": "connected",
  "mcp_server": "http://localhost:8020/sse"
}
```

### 3.2. Kiểm tra PWA

1. Mở trình duyệt và truy cập: `https://your-app.vercel.app`
2. Kiểm tra landing page hiển thị đúng
3. Thử đăng nhập/đăng ký
4. Test tính năng chat (lưu ý: WebSocket có thể không hoạt động)

### 3.3. Test PWA Installation

**Trên Desktop (Chrome/Edge):**
1. Mở app URL
2. Nhìn vào thanh địa chỉ, sẽ có icon "Install" (➕)
3. Click để cài đặt như một app

**Trên Mobile (Android/iOS):**
1. Mở app URL trên Safari/Chrome
2. Click "Add to Home Screen"
3. App sẽ xuất hiện như một native app

## 🔧 Bước 4: Xử lý vấn đề WebSocket (Nếu cần)

Vì Vercel không hỗ trợ persistent WebSocket, bạn có 2 lựa chọn:

### Option A: Chuyển sang Server-Sent Events (SSE)

Sửa file `pwa/js/chat.js` để dùng SSE thay vì WebSocket:

```javascript
// Thay vì WebSocket
const eventSource = new EventSource(`/api/chat/stream?user_id=${userId}`);
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};
```

### Option B: Deploy MCP Server riêng

Deploy `mcp_server.py` lên Railway/Render và cập nhật `MCP_SERVER_URL` trong Vercel environment variables.

## 🐛 Troubleshooting

### Lỗi: "Function Timeout"

**Nguyên nhân**: Function chạy quá 10 giây

**Giải pháp**:
- Giảm `timeout` trong các `asyncio.wait_for()` xuống 5-8 giây
- Tối ưu hóa database queries
- Upgrade lên Vercel Pro (60s timeout)

### Lỗi: "Module not found"

**Nguyên nhân**: Thiếu dependency trong `requirements.txt`

**Giải pháp**:
```bash
pip freeze > requirements.txt
git add requirements.txt
git commit -m "Update requirements"
git push
```

Vercel sẽ tự động redeploy.

### Lỗi: "Database connection failed"

**Nguyên nhân**: Environment variables chưa đúng

**Giải pháp**:
1. Vào Vercel Dashboard → Settings → Environment Variables
2. Kiểm tra lại `SUPABASE_URL` và `SUPABASE_KEY`
3. Redeploy: Deployments → ... → Redeploy

### PWA không hiện "Install" button

**Nguyên nhân**: 
- Chưa có HTTPS (Vercel tự động có)
- `manifest.json` hoặc `service-worker.js` lỗi

**Giải pháp**:
1. Mở DevTools → Application → Manifest
2. Kiểm tra lỗi
3. Mở DevTools → Application → Service Workers
4. Kiểm tra service worker đã register chưa

## 📊 Monitoring & Logs

### Xem Logs

1. Vào Vercel Dashboard
2. Chọn project → Deployments
3. Click vào deployment mới nhất
4. Tab **Functions** → Chọn function → **Logs**

### Real-time Logs

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# View logs
vercel logs
```

## 🔄 Cập nhật sau khi Deploy

Mỗi khi bạn push code mới lên Git:

```bash
git add .
git commit -m "Update feature X"
git push origin main
```

Vercel sẽ **tự động** detect và deploy lại (CI/CD).

## 🎯 Next Steps

Sau khi deploy thành công:

1. **Custom Domain** (optional):
   - Vercel Dashboard → Settings → Domains
   - Thêm domain của bạn (ví dụ: `app.yourdomain.com`)

2. **Analytics**:
   - Vercel Dashboard → Analytics
   - Xem traffic, performance metrics

3. **Production Optimization**:
   - Thêm caching headers
   - Optimize images
   - Minify CSS/JS

## 📚 Tài liệu tham khảo

- [Vercel Python Documentation](https://vercel.com/docs/functions/serverless-functions/runtimes/python)
- [PWA Checklist](https://web.dev/pwa-checklist/)
- [Supabase + Vercel Integration](https://supabase.com/docs/guides/getting-started/tutorials/with-vercel)

---

## 🆘 Cần hỗ trợ?

Nếu gặp vấn đề, hãy:
1. Kiểm tra Vercel logs
2. Test local trước: `uvicorn pwa_server:app --reload`
3. Hỏi trong Vercel Community: https://github.com/vercel/vercel/discussions
