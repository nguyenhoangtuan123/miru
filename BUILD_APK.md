# Hướng dẫn Build APK cho Miru

## Yêu cầu
- Node.js >= 18
- Java JDK >= 11 (cho Android)
- Android SDK (hoặc Android Studio)

## Cách 1: Sử dụng PWABuilder (Dễ nhất - Khuyến nghị)

### Bước 1: Deploy ứng dụng lên production
Đảm bảo app đã được deploy lên URL thật (vd: https://miru-app.railway.app)

### Bước 2: Truy cập PWABuilder
1. Vào https://www.pwabuilder.com/
2. Nhập URL production của bạn
3. Click "Start"

### Bước 3: Tải APK
1. Sau khi PWABuilder analyze xong, click "Package for stores"
2. Chọn "Android"
3. Điền thông tin:
   - **Package ID**: `com.miru.app`
   - **App name**: `Miru`
   - **Launcher name**: `Miru`
   - **App version**: `1.0.0`
   - **App version code**: `1`
   - **Host**: URL của bạn (vd: `miru-app.railway.app`)
   - **Start URL**: `/app`
   - **Theme color**: `#7f0df2`
   - **Background color**: `#050A1F`
   - **Signing key**: Chọn "New" để tạo key mới hoặc upload key có sẵn

4. Click "Generate"
5. Download file ZIP chứa APK

---

## Cách 2: Sử dụng Bubblewrap (CLI - Cho developer)

### Bước 1: Cài đặt Bubblewrap
```bash
npm install -g @anthropic-ai/anthropic-tools @anthropic-ai/sdk
```

### Bước 2: Khởi tạo project
```bash
mkdir miru-android && cd miru-android
bubblewrap init --manifest https://YOUR_DOMAIN/manifest.json
```

### Bước 3: Build APK
```bash
bubblewrap build
```

APK sẽ được tạo trong thư mục hiện tại.

---

## Cách 3: Sử dụng script tự động (Windows)

Chạy script PowerShell trong thư mục này:
```powershell
.\build-apk.ps1
```

---

## Lưu ý quan trọng

### 1. Digital Asset Links (Xác thực domain)
Để TWA hoạt động đúng, bạn cần thêm file `/.well-known/assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.miru.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

### 2. Lấy SHA256 fingerprint
```bash
keytool -list -v -keystore your-keystore.jks -alias your-alias
```

### 3. HTTPS bắt buộc
PWA phải được serve qua HTTPS để TWA hoạt động.

---

## Troubleshooting

### "App không mở trong TWA mode"
- Kiểm tra `assetlinks.json` đã đúng chưa
- Verify fingerprint SHA256 khớp với keystore

### "Icons bị mờ"
- Đảm bảo có icon 512x512 PNG
- Kiểm tra maskable icon có đủ safe zone (10% padding)

### "Service Worker không cache"
- Clear cache và reinstall PWA
- Kiểm tra console log trong DevTools

---

## Thông tin Miru App

| Field | Value |
|-------|-------|
| Package ID | `com.miru.app` |
| App Name | `Miru - AI Companion` |
| Short Name | `Miru` |
| Version | `1.0.0` |
| Theme Color | `#7f0df2` |
| Background | `#050A1F` |
| Start URL | `/app` |
| Display | `standalone` |
