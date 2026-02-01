# 🧠 Miru - Kế hoạch phát triển tính năng quản lý ngườii dùng & quản lý thân chủ cho nhà trị liệu

## 📋 Tổng quan

### 1.1 Mục tiêu
Xây dựng hệ thống quản lý ngườii dùng toàn diện và công cụ quản lý thân chủ chuyên nghiệp cho nhà trị liệu (NTL), giúp:
- Quản lý thông tin ngườii dùng một cách có hệ thống
- Hỗ trợ NTL theo dõi và quản lý thân chủ hiệu quả
- Tạo kênh liên lạc an toàn giữa NTL và thân chủ
- Cung cấp công cụ đánh giá tiến độ điều trị

### 1.2 Phạm vi hiện tại
Dựa trên codebase hiện có, hệ thống đã có:
- ✅ Authentication (Google OAuth)
- ✅ Therapist Dashboard cơ bản
- ✅ Ghép cặp NTL - Thân chủ
- ✅ Giao bài tập cho thân chủ
- ✅ Cảnh báo khủng hoảng

### 1.3 Các tính năng cần phát triển thêm

---

## 🎯 Phase 1: Quản lý Ngườii dùng (User Management)

### 1.1 Quản lý hồ sơ ngườii dùng

#### 1.1.1 Cập nhật thông tin cá nhân
- **Mô tả**: Cho phép ngườii dùng cập nhật thông tin cá nhân
- **Dữ liệu**:
  - Họ tên đầy đủ
  - Ngày sinh
  - Giới tính
  - Số điện thoại
  - Địa chỉ (tùy chọn)
  - Avatar tùy chỉnh
- **API Endpoint**: `PUT /api/users/{user_id}/profile`
- **UI**: Trang cài đặt hồ sơ trong PWA

#### 1.1.2 Quản lý cài đặt riêng tư
- **Mô tả**: Ngườii dùng kiểm soát dữ liệu được chia sẻ với NTL
- **Cài đặt**:
  - Cho phép NTL xem lịch sử chat: Yes/No
  - Cho phép NTL xem nhật ký cảm xúc: Yes/No
  - Cho phép NTL xem bài tập đã hoàn thành: Yes/No
  - Tự động xóa dữ liệu sau X tháng
- **API Endpoint**: `PUT /api/users/{user_id}/privacy-settings`

#### 1.1.3 Xóa tài khoản (GDPR/CCPA compliant)
- **Mô tả**: Ngườii dùng có thể yêu cầu xóa tài khoản và dữ liệu
- **Quy trình**:
  1. Yêu cầu xác nhận email
  2. Thông báo cho NTL (nếu có ghép cặp)
  3. Xóa dữ liệu sau 30 ngày grace period
  4. Giữ lại dữ liệu ẩn danh cho nghiên cứu (tùy chọn)
- **API Endpoint**: `POST /api/users/{user_id}/delete-request`

### 1.2 Quản lý vai trò ngườii dùng

#### 1.2.1 Phân quyền ngườii dùng
```
roles:
  - user: Ngườii dùng thông thường
  - therapist: Nhà trị liệu
  - admin: Quản trị viên hệ thống
```

#### 1.2.2 Chuyển đổi vai trò
- **User → Therapist**: Yêu cầu xác minh bằng cấp, giấy phép hành nghề
- **API Endpoint**: `POST /api/users/{user_id}/request-therapist-role`

### 1.3 Quản lý danh sách ngườii dùng (Admin)

#### 1.3.1 Dashboard Admin
- Danh sách tất cả ngườii dùng
- Bộ lọc: Theo vai trò, trạng thái, ngày đăng ký
- Thống kê: Số ngườii dùng mới, tỷ lệ active
- **API Endpoint**: `GET /api/admin/users`

#### 1.3.2 Khóa/Mở khóa tài khoản
- **API Endpoint**: `POST /api/admin/users/{user_id}/suspend`
- **API Endpoint**: `POST /api/admin/users/{user_id}/activate`

---

## 🎯 Phase 2: Quản lý Thân chủ nâng cao (Enhanced Client Management)

### 2.1 Hồ sơ thân chủ chi tiết

#### 2.1.1 Thông tin y khoa cơ bản
- **Mô tả**: NTL lưu trữ thông tin chuyên môn về thân chủ
- **Dữ liệu**:
  - Lý do đến trị liệu (presenting problem)
  - Tiền sử bệnh lý tâm lý
  - Thuốc đang sử dụng
  - Chẩn đoán sơ bộ (DSM-5 code tùy chọn)
  - Mục tiêu điều trị
- **Lưu ý**: Mã hóa dữ liệu nhạy cảm, chỉ NTL được phép truy cập
- **API Endpoint**: `PUT /api/therapist/clients/{client_id}/medical-profile`

#### 2.1.2 Ghi chú phiên trị liệu
- **Mô tả**: NTL ghi chú sau mỗi phiên làm việc
- **Dữ liệu**:
  - Ngày giờ phiên trị liệu
  - Loại phiên (online/offline)
  - Nội dung chính
  - Đánh giá tiến triển
  - Kế hoạch cho phiên tiếp theo
- **API Endpoint**: `POST /api/therapist/clients/{client_id}/session-notes`

### 2.2 Quản lý liên lạc

#### 2.2.1 Nhắn tin trực tiếp (Direct Messaging)
- **Mô tả**: Kênh chat an toàn giữa NTL và thân chủ
- **Tính năng**:
  - Tin nhắn text
  - Gửi file (giới hạn kích thước)
  - Thông báo đã đọc
  - Mã hóa end-to-end (tùy chọn)
- **API Endpoint**: 
  - `GET /api/therapist/clients/{client_id}/messages`
  - `POST /api/therapist/clients/{client_id}/messages`
- **UI**: Tab "Messages" trong Therapist Dashboard

#### 2.2.2 Lên lịch hẹn (Appointment Scheduling)
- **Mô tả**: Đặt lịch hẹn trị liệu
- **Tính năng**:
  - Tạo lịch hẹn mới
  - Gửi reminder (email/push notification)
  - Đồng bộ với Google Calendar
  - Thân chủ xác nhận/cancel appointment
- **API Endpoint**: `POST /api/therapist/clients/{client_id}/appointments`

#### 2.2.3 Thông báo khẩn cấp (Crisis Escalation)
- **Mô tả**: Cơ chế báo động khi thân chủ có dấu hiệu khủng hoảng nghiêm trọng
- **Cải tiến hiện tại**:
  - Phân loại mức độ: Low/Medium/High/Critical
  - Tự động gọi điện/SMS cho NTL khi Critical
  - Tạo báo cáo khủng hoảng tự động
  - Đề xuất protoccol xử lý

### 2.3 Đánh giá và báo cáo tiến độ

#### 2.3.1 Bảng đánh giá tiến độ (Progress Tracking)
- **Mô tả**: Theo dõi các chỉ số điều trị theo thờii gian
- **Chỉ số**:
  - Tần suất sử dụng app
  - Điểm mood trung bình theo tuần/tháng
  - Tỷ lệ hoàn thành bài tập
  - Số crisis event
  - Self-report scales (PHQ-9, GAD-7, v.v.)
- **API Endpoint**: `GET /api/therapist/clients/{client_id}/progress-metrics`

#### 2.3.2 Báo cáo tự động (Automated Reports)
- **Mô tả**: Tạo báo cáo tiến độ tự động
- **Tính năng**:
  - Báo cáo hàng tuần gửi qua email
  - Biểu đồ xu hướng cảm xúc
  - Phân tích pattern bằng AI
  - Đề xuất điều chỉnh điều trị
- **API Endpoint**: `GET /api/therapist/clients/{client_id}/reports/weekly`

#### 2.3.3 Ghi nhận outcome điều trị
- **Mô tả**: Đánh giá kết quả điều trị cuối cùng
- **Dữ liệu**:
  - Ngày kết thúc điều trị
  - Lý do kết thúc (hoàn thành/chuyển viện/bỏ ngang)
  - Đánh giá outcome (cải thiện/không cải thiện/xấu đi)
  - Feedback của thân chủ
- **API Endpoint**: `POST /api/therapist/clients/{client_id}/closure`

### 2.4 Quản lý nhóm thân chủ

#### 2.4.1 Phân nhóm thân chủ
- **Mô tả**: Tổ chức thân chủ thành các nhóm
- **Ví dụ nhóm**:
  - Theo chẩn đoán (lo âu, trầm cảm, PTSD)
  - Theo mức độ nghiêm trọng
  - Theo giai đoạn điều trị
  - Nhóm tùy chỉnh
- **API Endpoint**: 
  - `POST /api/therapist/client-groups`
  - `PUT /api/therapist/clients/{client_id}/group`

#### 2.4.2 Giao bài tập hàng loạt (Bulk Assignment)
- **Mô tả**: Giao cùng một bài tập cho nhiều thân chủ
- **API Endpoint**: `POST /api/therapist/assignments/bulk`

---

## 🎯 Phase 3: Bảo mật & Tuân thủ

### 3.1 Bảo mật dữ liệu y tế

#### 3.1.1 Mã hóa dữ liệu nhạy cảm
- Mã hóa AES-256 cho thông tin y khoa
- Mã hóa end-to-end cho tin nhắn
- Hash + salt cho dữ liệu nhận dạng

#### 3.1.2 Audit log
- Ghi log tất cả truy cập dữ liệu thân chủ
- Theo dõi ai xem/chỉnh sửa thông tin y khoa
- Báo cáo truy cập bất thường

### 3.2 Tuân thủ quy định

#### 3.2.1 HIPAA compliance (nếu áp dụng)
- Business Associate Agreement (BAA)
- Access controls
- Data encryption at rest and in transit
- Breach notification procedures

#### 3.2.2 GDPR compliance (EU)
- Right to access
- Right to erasure
- Data portability
- Consent management

---

## 📊 Database Schema Additions

### Bảng mới cần tạo

```sql
-- Extended User Profile
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    date_of_birth DATE,
    gender TEXT,
    phone TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Privacy Settings
CREATE TABLE user_privacy_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    allow_therapist_chat_history BOOLEAN DEFAULT TRUE,
    allow_therapist_mood_journal BOOLEAN DEFAULT TRUE,
    allow_therapist_assignments BOOLEAN DEFAULT TRUE,
    data_retention_months INTEGER DEFAULT 12,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Profile (encrypted)
CREATE TABLE client_medical_profiles (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    presenting_problem TEXT,
    psychiatric_history TEXT,
    current_medications TEXT,
    dsm5_codes TEXT[],
    treatment_goals TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(client_id, therapist_id)
);

-- Session Notes
CREATE TABLE therapist_session_notes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    session_date TIMESTAMPTZ NOT NULL,
    session_type TEXT DEFAULT 'online',
    session_content TEXT,
    progress_assessment TEXT,
    next_session_plan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Direct Messages
CREATE TABLE therapist_client_messages (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    sender_type TEXT NOT NULL, -- 'therapist' or 'client'
    message_content TEXT NOT NULL,
    attachments JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    type TEXT DEFAULT 'online', -- 'online', 'offline', 'phone'
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled', 'no_show'
    notes TEXT,
    client_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Groups
CREATE TABLE therapist_client_groups (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    name TEXT NOT NULL,
    description TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Client Group Memberships
CREATE TABLE therapist_client_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES therapist_client_groups(id),
    client_id TEXT REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(group_id, client_id)
);

-- Treatment Outcomes
CREATE TABLE treatment_outcomes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    closure_date DATE,
    closure_reason TEXT, -- 'completed', 'referred', 'dropped_out', 'moved'
    outcome_rating TEXT, -- 'improved', 'stable', 'worsened'
    client_feedback TEXT,
    therapist_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit Log
CREATE TABLE data_access_audit (
    id SERIAL PRIMARY KEY,
    accessor_id TEXT NOT NULL,
    accessor_type TEXT NOT NULL, -- 'therapist', 'admin', 'system'
    client_id TEXT REFERENCES users(id),
    action TEXT NOT NULL, -- 'view', 'edit', 'delete'
    resource_type TEXT NOT NULL, -- 'medical_profile', 'session_notes', 'messages'
    resource_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_messages_client_therapist ON therapist_client_messages(client_id, therapist_id);
CREATE INDEX idx_messages_created_at ON therapist_client_messages(created_at);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_session_notes_client ON therapist_session_notes(client_id);
CREATE INDEX idx_audit_accessor ON data_access_audit(accessor_id, accessed_at);
```

---

## 🎨 UI/UX Components

### 3.1 User Profile Page
```
/user-profile
├── Personal Info Tab
│   ├── Avatar upload
│   ├── Basic info form
│   └── Contact info
├── Privacy Settings Tab
│   ├── Data sharing toggles
│   └── Data retention settings
└── Account Tab
    ├── Change password (if applicable)
    ├── Download my data
    └── Delete account
```

### 3.2 Enhanced Therapist Dashboard
```
/therapist-dashboard
├── Overview
│   ├── Today's appointments
│   ├── Unread messages
│   └── Crisis alerts
├── Clients List (enhanced)
│   ├── Search & filter
│   ├── Group by tags
│   ├── Bulk actions
│   └── Export list
├── Individual Client View
│   ├── Overview card
│   ├── Medical profile (secure)
│   ├── Session notes history
│   ├── Message thread
│   ├── Progress charts
│   ├── Assignments
│   └── Appointments
└── Reports
    ├── Weekly summaries
    ├── Outcome analytics
    └── Client progress comparison
```

---

## 🔐 Security & Privacy Checklist

- [ ] Mã hóa dữ liệu y khoa trong database
- [ ] Implement audit logging
- [ ] Role-based access control (RBAC)
- [ ] Data anonymization for analytics
- [ ] GDPR data export functionality
- [ ] GDPR right to erasure
- [ ] Secure file upload validation
- [ ] Rate limiting cho API endpoints
- [ ] Session timeout cho NTL
- [ ] 2FA option cho NTL accounts

---

## 📅 Lộ trình triển khai

### Sprint 1 (Tuần 1-2): Foundation
- [ ] Tạo database tables mới
- [ ] API endpoints cơ bản cho user profile
- [ ] UI user profile page

### Sprint 2 (Tuần 3-4): Medical Profiles
- [ ] API medical profile (encrypted)
- [ ] API session notes
- [ ] UI medical profile trong therapist dashboard

### Sprint 3 (Tuần 5-6): Communication
- [ ] Direct messaging API
- [ ] Appointment scheduling API
- [ ] UI messaging interface
- [ ] UI appointment calendar

### Sprint 4 (Tuần 7-8): Analytics & Reporting
- [ ] Progress metrics API
- [ ] Automated reports
- [ ] Charts và visualizations
- [ ] Export functionality

### Sprint 5 (Tuần 9-10): Security & Compliance
- [ ] Audit logging
- [ ] Data encryption
- [ ] GDPR features
- [ ] Security testing

---

## 🤝 Integration với hệ thống hiện tại

- Sử dụng chung auth_middleware.py cho authentication
- Mở rộng từ therapist_service.py hiện có
- Tích hợp với therapist_routes.py
- UI mở rộng từ pwa/therapist-dashboard.html
- Database migration tuân theo format trong thư mục migrations/
