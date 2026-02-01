# 🧠 Miru - Kế hoạch tính năng Quản lý Người dùng & Thân chủ

## 📋 Tổng quan dự án

### Mục tiêu
Xây dựng hệ thống toàn diện cho phép nhà trị liệu (NTL) quản lý thân chủ một cách chuyên nghiệp, bao gồm:
- Quản lý hồ sơ người dùng
- Hồ sơ y khoa và ghi chú phiên trị liệu
- Nhắn tin trực tiếp với thân chủ
- Lên lịch hẹn trị liệu
- Đánh giá tiến độ điều trị
- Bảo mật và tuân thủ quy định

---

## 📊 Trạng thái hiện tại

### ✅ Đã hoàn thành

| Thành phần | File | Mô tả |
|------------|------|-------|
| Database Schema | `migrations/007_therapist_client_management.sql` | 12 bảng mới cho user profiles, medical profiles, messages, appointments, groups, audit |
| Therapist Service | `therapist_service.py` | Service tổng hợp với 900+ dòng code |
| API Routes | `therapist_routes.py` | Router chính với modular sub-routers |
| Medical Routes | `therapist_routes_medical.py` | API cho medical profiles và session notes |
| Messaging Routes | `therapist_routes_messaging.py` | API cho tin nhắn |
| Appointment Routes | `therapist_routes_appointments.py` | API cho lịch hẹn |
| Group Routes | `therapist_routes_groups.py` | API cho nhóm thân chủ |
| Frontend Dashboard | `pwa/therapist-dashboard.html` | UI dashboard với tab navigation |
| Frontend JS | `pwa/js/therapist-dashboard.js` | JavaScript module riêng biệt |
| Data Inventory | `plans/client-data-inventory.md` | Tài liệu về dữ liệu thân chủ |

### 🔄 Đang triển khai

| Thành phần | Trạng thái | Ghi chú |
|------------|------------|---------|
| Therapist modules services | Cần kiểm tra | Cần xác nhận các file trong `therapist/` folder |
| RLS Policies | Chưa triển khai | Cần cấu hình Row Level Security trong Supabase |
| Frontend modularization | Hoàn thành | JavaScript đã tách riêng |

### ⏳ Chưa triển khai

| Thành phần | Ưu tiên | Mô tả |
|------------|---------|-------|
| User Profile Management | Cao | API và UI cho user cập nhật profile |
| Privacy Settings UI | Cao | Cho phép user quản lý quyền riêng tư |
| Progress Analytics | Trung bình | Charts và visualizations |
| Bulk Operations | Thấp | Giao bài tập hàng loạt |
| Calendar Sync | Thấp | Đồng bộ với Google Calendar |
| Audit Dashboard | Trung bình | UI xem audit logs |
| Email/Push Notifications | Trung bình | Reminder và alerts |

---

## 🗄️ Database Schema (Đã tạo)

### Bảng đã có trong migration 007

```sql
-- 1. User Profiles
user_profiles (user_id, date_of_birth, gender, phone, address, emergency_contact_*)

-- 2. Privacy Settings
user_privacy_settings (allow_therapist_chat_history, allow_therapist_mood_journal, ...)

-- 3. Medical Profiles
client_medical_profiles (presenting_problem, psychiatric_history, medications, dsm5_codes, treatment_goals, ...)

-- 4. Session Notes
therapist_session_notes (session_date, session_type, session_content, interventions_used, progress_assessment, ...)

-- 5. Direct Messages
therapist_client_messages (sender_type, message_content, attachments, is_read, ...)

-- 6. Appointments
appointments (appointment_date, duration_minutes, type, status, meeting_link, ...)

-- 7. Progress Metrics
client_progress_metrics (app_usage_days, emotion_score, assignments_completed, phq9_score, ...)

-- 8. Client Groups
therapist_client_groups (name, description, color)
therapist_client_group_members (group_id, client_id)

-- 9. Treatment Outcomes
treatment_outcomes (closure_reason, outcome_rating, goals_achieved, ...)

-- 10. Audit Log
data_access_audit (accessor_id, action, resource_type, ...)

-- 11. Privacy Consent
privacy_consent_log (consent_type, consent_given, ...)
```

---

## 🔌 API Endpoints (Đã triển khai)

### Therapist Management
```
GET    /api/therapist/me/{therapist_id}         - Lấy thông tin NTL
GET    /api/therapist/clients/{therapist_id}    - Lấy danh sách thân chủ
POST   /api/therapist/clients/{therapist_id}/pair - Ghép cặp với thân chủ
```

### Medical Profiles
```
GET    /api/therapist/{therapist_id}/clients/{client_id}/medical-profile
PUT    /api/therapist/{therapist_id}/clients/{client_id}/medical-profile
GET    /api/therapist/{therapist_id}/clients/{client_id}/session-notes
POST   /api/therapist/{therapist_id}/clients/{client_id}/session-notes
```

### Messaging
```
GET    /api/therapist/{therapist_id}/clients/{client_id}/messages
POST   /api/therapist/{therapist_id}/clients/{client_id}/messages
POST   /api/therapist/{therapist_id}/conversations/{client_id}/read
```

### Appointments
```
GET    /api/therapist/appointments/{therapist_id}/upcoming
GET    /api/therapist/appointments/{therapist_id}/{appointment_id}
POST   /api/therapist/appointments/{therapist_id}
PUT    /api/therapist/appointments/{therapist_id}/{appointment_id}/status
```

### Groups
```
GET    /api/therapist/client-groups/{therapist_id}
POST   /api/therapist/client-groups/{therapist_id}
POST   /api/therapist/client-groups/{therapist_id}/{group_id}/members
```

---

## 🎯 Lộ trình phát triển

### Phase 1: Core Features (Đã hoàn thành về cơ bản)
- [x] Database schema cho therapist-client management
- [x] API endpoints cho medical profiles, messages, appointments, groups
- [x] Therapist dashboard UI
- [x] Modular JavaScript

### Phase 2: User Management & Privacy (Tiếp theo)
- [ ] **User Profile API** - `PUT /api/users/{user_id}/profile`
- [ ] **Privacy Settings API** - `PUT /api/users/{user_id}/privacy-settings`
- [ ] **User Profile Page** - UI trong PWA `/settings.html`
- [ ] **Privacy Settings UI** - Toggle controls cho data sharing

### Phase 3: Analytics & Reporting
- [ ] **Progress Metrics API** - Tổng hợp dữ liệu theo tuần/tháng
- [ ] **Charts Integration** - Biểu đồ emotion trends
- ** **Automated Reports** - Báo cáo tự động gửi email

### Phase 4: Security & Compliance
- [ ] **RLS Policies** - Row Level Security trong Supabase
- [ ] **Audit Log API** - API cho xem access logs
- [ ] **Data Encryption** - Mã hóa dữ liệu nhạy cảm

### Phase 5: Advanced Features
- [ ] **Bulk Operations** - Giao bài tập hàng loạt
- [ ] **Calendar Integration** - Google Calendar sync
- [ ] **Email Notifications** - Reminder và alerts qua email

---

## 🔐 Bảo mật & Quyền riêng tư

### Dữ liệu NTL có thể truy cập (với consent)
| Dữ liệu | Yêu cầu | Mô tả |
|---------|---------|-------|
| Chat history | allow_therapist_chat_history = TRUE | Lịch sử chat với AI |
| Mood journal | allow_therapist_mood_journal = TRUE | Nhật ký cảm xúc |
| Goals | allow_therapist_goals = TRUE | Mục tiêu đã đặt |
| Memories | allow_therapist_memories = TRUE | Ký ức từ Mem0 |
| Assignments | Luôn có | Bài tập được giao |

### Dữ liệu chỉ NTL tạo/xem
| Dữ liệu | Quyền |
|---------|-------|
| Medical profiles | Chỉ NTL được phép xem/sửa |
| Session notes | Chỉ NTL được phép xem/sửa |
| Treatment outcomes | Chỉ NTL được phép xem/sửa |

### Audit Logging
Tất cả truy cập dữ liệu thân chủ được ghi log vào bảng `data_access_audit`:
- Ai truy cập (accessor_id)
- Loại người dùng (therapist/admin/system)
- Hành động (view/edit/delete/export)
- Thời gian (accessed_at)

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
|------------|-----------|
| Backend | FastAPI (Python) |
| Database | Supabase (PostgreSQL + pgvector) |
| Authentication | Google OAuth + JWT |
| Frontend | Vanilla JavaScript PWA |
| Styling | CSS (không dùng framework) |
| Embeddings | Google Gemini text-embedding-004 |

---

## 📝 Ghi chú triển khai

### Kiểm tra trước khi deploy
1. ✅ Database migration đã chạy
2. ✅ RLS policies được kích hoạt
3. ✅ API endpoints được test
4. ✅ Frontend JavaScript không có lỗi
5. ✅ Authentication middleware hoạt động

### Monitoring cần thiết
- Số lượng thân chủ per therapist
- Tần suất sử dụng messaging
- Số lượng crisis events
- Thời gian phản hồi API

---

## 📞 Liên hệ & Hỗ trợ

- **Developer**: Miru Team
- **Documentation**: Xem `docs/` folder
- **Database Schema**: `migrations/007_therapist_client_management.sql`
- **API Documentation**: Inline comments trong `therapist_routes.py`
