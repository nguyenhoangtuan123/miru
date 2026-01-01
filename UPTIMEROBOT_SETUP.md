# 🔄 Keep Render Backend Alive - UptimeRobot Setup Guide

## Vấn đề
Render Free Tier tự động sleep sau **15 phút không hoạt động**. Khi sleep:
- ❌ Server mất ~30 giây để wake up
- ❌ User phải đợi lâu khi truy cập
- ❌ WebSocket connections bị disconnect

## Giải pháp
Sử dụng **UptimeRobot** để ping server mỗi 5 phút → server luôn sống!

---

## 📋 Hướng dẫn từng bước

### Bước 1: Đăng ký UptimeRobot

1. Truy cập: https://uptimerobot.com/
2. Click **"Sign Up Free"** (góc trên bên phải)
3. Điền thông tin:
   - Email: `your-email@gmail.com`
   - Password: `your-secure-password`
4. Click **"Sign Up"**
5. Xác nhận email (check hộp thư đến)

---

### Bước 2: Tạo Monitor cho Backend

1. Sau khi login, click **"+ Add New Monitor"**

2. Điền thông tin:

**Monitor Type:**
```
HTTP(s)
```

**Friendly Name:**
```
Reflection Backend
```

**URL (or IP):**
```
https://reflection-backend-twh1.onrender.com/
```

**Monitoring Interval:**
```
Every 5 minutes
```
*(Free tier cho phép tối thiểu 5 phút)*

**Monitor Timeout:**
```
30 seconds
```

**Alert Contacts:**
- Chọn email của bạn (để nhận thông báo nếu server down)

3. Click **"Create Monitor"**

---

### Bước 3: Xác nhận hoạt động

Sau khi tạo, bạn sẽ thấy:

```
✅ Reflection Backend
   Status: Up
   Uptime: 100%
   Last Check: Just now
```

UptimeRobot sẽ:
- ✅ Ping `https://reflection-backend-twh1.onrender.com/` mỗi 5 phút
- ✅ Giữ server luôn sống
- ✅ Gửi email nếu server down
- ✅ Hiển thị uptime statistics

---

## 🎯 Kết quả

**Trước khi setup:**
- Server sleep sau 15 phút
- Wake up mất ~30 giây
- User experience kém

**Sau khi setup:**
- ✅ Server luôn sống 24/7
- ✅ Response time nhanh
- ✅ Không cần đợi wake up
- ✅ WebSocket stable

---

## 📊 Dashboard Features (Miễn phí)

UptimeRobot cung cấp:
- **Uptime Monitoring**: Theo dõi % uptime
- **Response Time**: Đo thời gian phản hồi
- **Alert Notifications**: Email khi server down
- **Public Status Page**: Chia sẻ status với users (optional)
- **50 Monitors**: Free tier cho phép tối đa 50 monitors

---

## 🔧 Nâng cao (Optional)

### Thêm Monitor cho Frontend

Nếu muốn monitor cả frontend:

1. Click **"+ Add New Monitor"** lần nữa
2. Điền:
   - Friendly Name: `Reflection Frontend`
   - URL: `https://reflection-frontend.onrender.com/`
   - Interval: Every 5 minutes
3. Create Monitor

### Tạo Public Status Page

1. Vào **"Public Status Pages"** tab
2. Click **"Add New Status Page"**
3. Chọn monitors muốn hiển thị
4. Nhận URL public: `https://stats.uptimerobot.com/your-page`
5. Chia sẻ với users để họ biết server status

---

## ⚠️ Lưu ý

**Free Tier Limits:**
- ✅ 50 monitors
- ✅ 5-minute interval (tối thiểu)
- ✅ Email alerts
- ❌ SMS alerts (cần upgrade)
- ❌ 1-minute interval (cần upgrade)

**Đối với Render Free Tier:**
- 5 phút interval là đủ để giữ server sống
- Không cần upgrade UptimeRobot
- Hoàn toàn miễn phí!

---

## ✅ Checklist

- [ ] Đăng ký UptimeRobot
- [ ] Xác nhận email
- [ ] Tạo monitor cho backend
- [ ] Kiểm tra status "Up"
- [ ] (Optional) Tạo monitor cho frontend
- [ ] (Optional) Setup public status page

---

## 🎉 Hoàn thành!

Sau khi setup, server của bạn sẽ:
- ✅ Luôn sống 24/7
- ✅ Response nhanh
- ✅ Không bị sleep
- ✅ Tự động alert nếu có vấn đề

**Không cần làm gì thêm!** UptimeRobot sẽ tự động ping mỗi 5 phút.

---

## 📞 Support

Nếu gặp vấn đề:
- UptimeRobot Docs: https://uptimerobot.com/help/
- UptimeRobot Support: support@uptimerobot.com
