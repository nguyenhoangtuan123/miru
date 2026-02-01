# 🔐 Ma trận truy cập dữ liệu - Nhà trị liệu (Therapist)

## Tổng quan

Tài liệu này mô tả chi tiết dữ liệu nào của thân chủ mà nhà trị liệu (NTL) có thể truy cập, điều kiện truy cập, và dữ liệu nào cần bổ sung.

---

## 1. Dữ liệu hiện tại NTL có thể truy cập

### 1.1 Thông tin cơ bản thân chủ (Public)
| Dữ liệu | Nguồn | Quyền truy cập | Điều kiện |
|---------|-------|----------------|-----------|
| Tên | `users.name` | ✅ Có thể xem | Khi đã ghép cặp |
| Email | `users.email` | ✅ Có thể xem | Khi đã ghép cặp |
| Avatar | `users.picture` | ✅ Có thể xem | Khi đã ghép cặp |
| Ngày ghép cặp | `therapist_clients.paired_at` | ✅ Có thể xem | NTL là ngườii ghép cặp |
| Trạng thái ghép cặp | `therapist_clients.status` | ✅ Có thể xem | NTL là ngườii ghép cặp |

### 1.2 Dữ liệu tương tác (Interaction Data)
| Dữ liệu | Nguồn | Quyền truy cập | Điều kiện |
|---------|-------|----------------|-----------|
| Bài tập đã giao | `assignments` | ✅ Full quyền | NTL là ngườii tạo |
| Trạng thái bài tập | `assignments.status` | ✅ Có thể xem | NTL là ngườii tạo |
| Crisis events | `crisis_events` | ✅ Có thể xem | Liên quan đến thân chủ của NTL |
| Ghi chú crisis | `crisis_events.therapist_notes` | ✅ Full quyền | NTL được assign |

### 1.3 Dữ liệu tổng hợp (Aggregated Data)
| Dữ liệu | Nguồn | Quyền truy cập | Điều kiện |
|---------|-------|----------------|-----------|
| Tổng số session | Đếm từ `chat_messages` | ✅ Có thể xem | Đã ghép cặp |
| Số bài tập hoàn thành | Đếm từ `assignments` | ✅ Có thể xem | NTL là ngườii tạo |
| Số crisis events | Đếm từ `crisis_events` | ✅ Có thể xem | Liên quan đến thân chủ |

---

## 2. Dữ liệu thân chủ hiện chưa cho NTL truy cập

### 2.1 Dữ liệu Chat (Cần user consent)
| Dữ liệu | Nguồn | Trạng thái | Ghi chú |
|---------|-------|------------|---------|
| Lịch sử chat chi tiết | `chat_messages` | ❌ Chưa có | Cần user consent |
| Nội dung tin nhắn | `chat_messages.content` | ❌ Chưa có | Rất nhạy cảm |
| Session summaries | `session_summaries` | ❌ Chưa có | Cần user consent |
| Analyzed sessions | `analyzed_sessions` | ❌ Chưa có | Có thể hữu ích cho NTL |

### 2.2 Dữ liệu Cảm xúc & Nhật ký (Cần user consent)
| Dữ liệu | Nguồn | Trạng thái | Ghi chú |
|---------|-------|------------|---------|
| Journal entries | `journal_entries` | ❌ Chưa có | Private theo mặc định |
| Mood check-ins | `moment_checkins` | ❌ Chưa có | Cần user consent |
| Emotion scores | `analyzed_sessions.emotion_score` | ❌ Chưa có | Có thể ẩn danh |

### 2.3 Dữ liệu Memory (Mem0)
| Dữ liệu | Nguồn | Trạng thái | Ghi chú |
|---------|-------|------------|---------|
| Facts về user | `memories` | ❌ Chưa có | Rất nhạy cảm |
| Knowledge graph | Graph store | ❌ Chưa có | Cần filter theo user |

### 2.4 Dữ liệu Goals
| Dữ liệu | Nguồn | Trạng thái | Ghi chú |
|---------|-------|------------|---------|
| Mục tiêu của thân chủ | `goals` | ❌ Chưa có | Có thể hữu ích cho NTL |
| Tiến độ mục tiêu | `goals.completed` | ❌ Chưa có | Theo dõi điều trị |

---

## 3. Dữ liệu cần bổ sung cho quản lý thân chủ

### 3.1 Thông tin y khoa (Medical Profile) - MỚI
```sql
-- Bảng mới: client_medical_profiles
CREATE TABLE client_medical_profiles (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    -- Thông tin điều trị
    presenting_problem TEXT,           -- Lý do đến trị liệu
    psychiatric_history TEXT,          -- Tiền sử bệnh lý
    current_medications TEXT,          -- Thuốc đang dùng
    allergies TEXT,                    -- Dị ứng thuốc
    dsm5_codes TEXT[],                 -- Mã chẩn đoán DSM-5
    
    -- Mục tiêu điều trị
    treatment_goals TEXT,              -- Mục tiêu ngắn hạn/dài hạn
    treatment_plan TEXT,               -- Kế hoạch điều trị
    estimated_sessions INTEGER,        -- Số phiên dự kiến
    
    -- Thông tin khẩn cấp
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(client_id, therapist_id)
);
```

### 3.2 Ghi chú phiên trị liệu (Session Notes) - MỚI
```sql
-- Bảng mới: therapist_session_notes
CREATE TABLE therapist_session_notes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    -- Thông tin phiên
    session_date TIMESTAMPTZ NOT NULL,
    session_type TEXT DEFAULT 'online', -- 'online', 'offline', 'phone'
    duration_minutes INTEGER,           -- Thờii lượng phiên
    
    -- Nội dung
    session_content TEXT,               -- Nội dung chính
    client_presentation TEXT,           -- Biểu hiện của thân chủ
    interventions_used TEXT[],          -- Can thiệp đã sử dụng
    
    -- Đánh giá
    progress_assessment TEXT,           -- Đánh giá tiến triển
    mood_observation TEXT,              -- Quan sát cảm xúc
    risk_assessment TEXT,               -- Đánh giá rủi ro
    
    -- Kế hoạch
    next_session_plan TEXT,             -- Kế hoạch phiên tiếp
    homework_assigned TEXT,             -- Bài tập về nhà
    
    -- Ghi chú riêng tư
    private_notes TEXT,                 -- Ghi chú không chia sẻ
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Nhắn tin trực tiếp (Direct Messaging) - MỚI
```sql
-- Bảng mới: therapist_client_messages
CREATE TABLE therapist_client_messages (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    sender_type TEXT NOT NULL,          -- 'therapist' hoặc 'client'
    message_content TEXT NOT NULL,      -- Nội dung tin nhắn
    
    -- File đính kèm
    attachments JSONB,                  -- [{name, url, type, size}]
    
    -- Trạng thái
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_messages_client_therapist 
    ON therapist_client_messages(client_id, therapist_id);
CREATE INDEX idx_messages_created_at 
    ON therapist_client_messages(created_at);
```

### 3.4 Lịch hẹn (Appointments) - MỚI
```sql
-- Bảng mới: appointments
CREATE TABLE appointments (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    -- Thờii gian
    appointment_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 60,
    timezone TEXT DEFAULT 'Asia/Ho_Chi_Minh',
    
    -- Loại hình
    type TEXT DEFAULT 'online',         -- 'online', 'offline', 'phone'
    location TEXT,                      -- Địa điểm (nếu offline)
    meeting_link TEXT,                  -- Link meeting (nếu online)
    
    -- Trạng thái
    status TEXT DEFAULT 'scheduled',    -- 'scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled'
    
    -- Xác nhận
    client_confirmed BOOLEAN DEFAULT FALSE,
    therapist_confirmed BOOLEAN DEFAULT TRUE,
    
    -- Nhắc nhở
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,
    
    -- Ghi chú
    notes TEXT,
    cancellation_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.5 Đánh giá tiến độ (Progress Metrics) - MỚI
```sql
-- Bảng mới: client_progress_metrics
CREATE TABLE client_progress_metrics (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    -- Thờii kỳ
    week_number INTEGER,                -- Tuần thứ mấy của năm
    year INTEGER,
    
    -- Chỉ số từ app
    app_usage_days INTEGER,             -- Số ngày sử dụng app
    total_chat_sessions INTEGER,        -- Số phiên chat
    avg_emotion_score DECIMAL(3,1),     -- Điểm cảm xúc TB
    journal_entries_count INTEGER,      -- Số nhật ký viết
    
    -- Chỉ số từ NTL
    assignments_completed INTEGER,      -- Bài tập hoàn thành
    assignments_total INTEGER,          -- Tổng bài tập giao
    appointments_attended INTEGER,      -- Số buổi hẹn đã đến
    appointments_total INTEGER,         -- Tổng số buổi hẹn
    
    -- Đánh giá NTL
    therapist_assessment TEXT,          -- Đánh giá tổng quan
    progress_rating INTEGER CHECK (progress_rating BETWEEN 1 AND 10),
    
    -- Self-report scales
    phq9_score INTEGER,                 -- Depression screening
    gad7_score INTEGER,                 -- Anxiety screening
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.6 Phân nhóm thân chủ (Client Groups) - MỚI
```sql
-- Bảng mới: therapist_client_groups
CREATE TABLE therapist_client_groups (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    
    name TEXT NOT NULL,                 -- Tên nhóm
    description TEXT,                   -- Mô tả
    color TEXT,                         -- Màu sắc đại diện
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng: therapist_client_group_members
CREATE TABLE therapist_client_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES therapist_client_groups(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, client_id)
);
```

### 3.7 Kết quả điều trị (Treatment Outcomes) - MỚI
```sql
-- Bảng mới: treatment_outcomes
CREATE TABLE treatment_outcomes (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    -- Thông tin kết thúc
    closure_date DATE,
    closure_reason TEXT,                -- 'completed', 'referred', 'dropped_out', 'moved', 'other'
    
    -- Đánh giá outcome
    outcome_rating TEXT,                -- 'significantly_improved', 'improved', 'stable', 'worsened'
    
    -- Goals achievement
    goals_total INTEGER,
    goals_achieved INTEGER,
    
    -- Feedback
    client_feedback TEXT,               -- Phản hồi của thân chủ
    therapist_notes TEXT,               -- Ghi chú của NTL
    lessons_learned TEXT,               -- Bài học rút ra
    
    -- Follow-up
    follow_up_recommended BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.8 Audit Log (Theo dõi truy cập) - MỚI
```sql
-- Bảng mới: data_access_audit
CREATE TABLE data_access_audit (
    id SERIAL PRIMARY KEY,
    
    -- Ngườii truy cập
    accessor_id TEXT NOT NULL,          -- ID ngườii truy cập
    accessor_type TEXT NOT NULL,        -- 'therapist', 'admin', 'system'
    
    -- Dữ liệu được truy cập
    client_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,               -- 'view', 'edit', 'delete', 'export'
    resource_type TEXT NOT NULL,        -- 'medical_profile', 'session_notes', 'messages', 'chat_history'
    resource_id INTEGER,
    
    -- Thông tin request
    ip_address INET,
    user_agent TEXT,
    
    accessed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_client ON data_access_audit(client_id, accessed_at);
CREATE INDEX idx_audit_accessor ON data_access_audit(accessor_id, accessed_at);
```

---

## 4. Privacy Settings cho User

### 4.1 Bảng cài đặt riêng tư
```sql
-- Bảng mới: user_privacy_settings
CREATE TABLE user_privacy_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    
    -- Cho phép NTL xem dữ liệu
    allow_therapist_chat_history BOOLEAN DEFAULT FALSE,
    allow_therapist_mood_journal BOOLEAN DEFAULT FALSE,
    allow_therapist_assignments BOOLEAN DEFAULT TRUE,  -- Mặc định cho phép
    allow_therapist_goals BOOLEAN DEFAULT FALSE,
    allow_therapist_memories BOOLEAN DEFAULT FALSE,
    
    -- Giới hạn thờii gian
    share_history_days INTEGER DEFAULT 30,  -- Chỉ chia sẻ dữ liệu X ngày gần nhất
    
    -- Thông báo
    notify_when_therapist_access BOOLEAN DEFAULT TRUE,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Consent log
```sql
-- Bảng mới: privacy_consent_log
CREATE TABLE privacy_consent_log (
    id SERIAL PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    
    consent_type TEXT NOT NULL,         -- 'chat_history', 'mood_journal', 'medical_data'
    consent_given BOOLEAN NOT NULL,
    consent_date TIMESTAMPTZ DEFAULT NOW(),
    
    ip_address INET,
    user_agent TEXT
);
```

---

## 5. Tóm tắt các tính năng cần phát triển

### 5.1 Backend API Endpoints cần tạo

```python
# User Management APIs
GET    /api/users/{user_id}/profile
PUT    /api/users/{user_id}/profile
GET    /api/users/{user_id}/privacy-settings
PUT    /api/users/{user_id}/privacy-settings
POST   /api/users/{user_id}/delete-request

# Therapist Client Management APIs
GET    /api/therapist/clients/{client_id}/medical-profile
PUT    /api/therapist/clients/{client_id}/medical-profile
GET    /api/therapist/clients/{client_id}/session-notes
POST   /api/therapist/clients/{client_id}/session-notes
GET    /api/therapist/clients/{client_id}/messages
POST   /api/therapist/clients/{client_id}/messages
GET    /api/therapist/clients/{client_id}/appointments
POST   /api/therapist/clients/{client_id}/appointments
GET    /api/therapist/clients/{client_id}/progress-metrics
GET    /api/therapist/clients/{client_id}/reports/weekly

# Client Groups APIs
GET    /api/therapist/client-groups
POST   /api/therapist/client-groups
PUT    /api/therapist/client-groups/{group_id}
DELETE /api/therapist/client-groups/{group_id}
POST   /api/therapist/client-groups/{group_id}/members

# Admin APIs
GET    /api/admin/users
POST   /api/admin/users/{user_id}/suspend
POST   /api/admin/users/{user_id}/activate
GET    /api/admin/audit-logs
```

### 5.2 Frontend Pages cần tạo/cập nhật

```
PWA Pages:
├── /user-profile (MỚI)
│   ├── Personal Info Tab
│   ├── Privacy Settings Tab
│   └── Account Tab
│
├── /therapist-dashboard (CẬP NHẬT)
│   ├── Overview Tab
│   ├── Clients List (cải tiến)
│   ├── Client Detail View (MỚI)
│   │   ├── Overview
│   │   ├── Medical Profile
│   │   ├── Session Notes
│   │   ├── Messages
│   │   ├── Progress Charts
│   │   └── Appointments
│   ├── Calendar (MỚI)
│   └── Reports (MỚI)
│
└── /admin-dashboard (MỚI)
    ├── Users Management
    ├── Audit Logs
    └── System Settings
```

---

## 6. Security & Compliance Checklist

- [ ] Mã hóa dữ liệu y khoa (medical_profiles, session_notes)
- [ ] Audit logging cho tất cả truy cập dữ liệu thân chủ
- [ ] Row Level Security (RLS) trong Supabase
- [ ] User consent management
- [ ] Data retention policies
- [ ] GDPR right to erasure
- [ ] GDPR data portability
- [ ] HIPAA compliance (nếu áp dụng)
- [ ] Rate limiting cho API
- [ ] 2FA cho therapist accounts
