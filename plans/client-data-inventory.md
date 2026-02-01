# 📊 Danh mục dữ liệu Thân chủ trong hệ thống Miru

## Tổng quan

Đây là danh sách đầy đủ các loại dữ liệu của thân chủ (ngườii dùng) được lưu trữ trong hệ thống Miru, bao gồm vị trí lưu trữ và mô tả chi tiết.

---

## 1. Dữ liệu Cơ bản (Basic User Data)

### 1.1 Thông tin định danh
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Google User ID | `users.id` (Supabase) | ID định danh duy nhất từ Google OAuth |
| Email | `users.email` (Supabase) | Email đăng ký |
| Họ tên | `users.name` (Supabase) | Tên hiển thị |
| Avatar | `users.picture` (Supabase) | URL ảnh đại diện |
| Trạng thái | `users.is_active` (Supabase) | Tài khoản đang hoạt động hay không |
| Ngày tạo | `users.created_at` (Supabase) | Thờii điểm đăng ký |
| Đăng nhập cuối | `users.last_login` (Supabase) | Thờii điểm đăng nhập gần nhất |

### 1.2 Cấu trúc bảng
```sql
-- Bảng: users (migrations/002_create_users_table.sql)
CREATE TABLE users (
    id TEXT PRIMARY KEY,              -- Google user ID
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,                     -- Profile picture URL
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
```

---

## 2. Dữ liệu Cuộc trò chuyện (Chat Data)

### 2.1 Tin nhắn chat
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Nội dung tin nhắn | `chat_messages.content` (Supabase) | Nội dung tin nhắn user/AI |
| Vai trò | `chat_messages.role` (Supabase) | 'user' hoặc 'ai' |
| Session ID | `chat_messages.session_id` (Supabase) | Liên kết đến session |
| Thờii gian | `chat_messages.created_at` (Supabase) | Thờii điểm gửi tin nhắn |

### 2.2 Session summaries (Tóm tắt phiên)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Tóm tắt nội dung | `session_summaries.summary_text` (Supabase) | Tóm tắt cuộc trò chuyện |
| Embedding vector | `session_summaries.embedding` (Supabase) | Vector embedding cho tìm kiếm |
| User ID | `session_summaries.user_id` (Supabase) | Liên kết đến user |
| Thờii gian | `session_summaries.created_at` (Supabase) | Thờii điểm tạo tóm tắt |

### 2.3 Cấu trúc bảng
```sql
-- Bảng: chat_messages (migrations/005_create_chat_messages.sql)
CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES session_summaries(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 3. Dữ liệu Memory (Mem0)

### 3.1 Facts (Sự kiện/Facts)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Facts về user | `memories` (Supabase vector store) | Thông tin chiết xuất từ cuộc trò chuyện |
| Metadata | `memories.metadata` | User ID, timestamp, categories |
| Embedding | `memories.embedding` | Vector embedding để tìm kiếm |

### 3.2 Session Facts (Facts theo phiên)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Facts phiên | `facts.txt` (local file system) | Facts được trích xuất từ mỗi session |
| Vị trí | `./memories/session_{id}/facts.txt` | File local tạm thờii |

### 3.3 Analyzed Sessions
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Emotion score | `analyzed_sessions.emotion_score` (Supabase) | Điểm cảm xúc 1-10 |
| Dominant emotion | `analyzed_sessions.dominant_emotion` (Supabase) | Cảm xúc chủ đạo |
| Topics | `analyzed_sessions.topics` (Supabase) | Các chủ đề thảo luận |
| Key moments | `analyzed_sessions.key_moments` (Supabase) | Các khoảnh khắc quan trọng (JSON) |
| AI summary | `analyzed_sessions.ai_summary` (Supabase) | Tóm tắt AI tạo ra |
| AI title | `analyzed_sessions.ai_title` (Supabase) | Tiêu đề tự động tạo |

### 3.4 Cấu trúc bảng
```sql
-- Bảng: analyzed_sessions (migrations/001_create_analyzed_sessions.sql)
CREATE TABLE IF NOT EXISTS analyzed_sessions (
    id SERIAL PRIMARY KEY,
    session_id INTEGER,
    user_id INTEGER,
    emotion_score INTEGER CHECK (emotion_score >= 1 AND emotion_score <= 10),
    dominant_emotion VARCHAR(50),
    topics TEXT[],
    key_moments JSONB,
    ai_summary TEXT,
    ai_title VARCHAR(100),
    analyzed_at TIMESTAMP DEFAULT NOW(),
    analyzer_version VARCHAR(20) DEFAULT 'v1.0',
    UNIQUE(session_id)
);
```

---

## 4. Dữ liệu Nhật ký & Cảm xúc (Journal & Mood Data)

### 4.1 Journal Entries (Nhật ký)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Tiêu đề | `journal_entries.title` (Supabase) | Tiêu đề nhật ký |
| Nội dung | `journal_entries.content` (Supabase) | Nội dung chi tiết |
| Mood | `journal_entries.mood` (Supabase) | Cảm xúc: 'happy', 'sad', 'neutral', v.v. |
| Tags | `journal_entries.tags` (Supabase) | Các tag liên quan (mảng) |
| Thờii gian | `journal_entries.created_at` (Supabase) | Ngày viết nhật ký |

### 4.2 Mood Check-ins
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Emotion score | `moment_checkins.emotion_score` | Điểm cảm xúc 1-10 |
| Context tags | `moment_checkins.context_tags` | Ngữ cảnh (mảng) |
| Ghi chú | `moment_checkins.note` | Ghi chú thêm |
| Thờii gian | `moment_checkins.created_at` | Thờii điểm check-in |

### 4.3 Cấu trúc bảng
```sql
-- Bảng: journal_entries (migrations/002_create_journal_entries.sql)
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(255),
    content TEXT,
    mood VARCHAR(50),
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 5. Dữ liệu Mục tiêu (Goals Data)

### 5.1 Goals (Mục tiêu)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Tiêu đề | `goals.title` (Supabase) | Tên mục tiêu |
| Mô tả | `goals.description` (Supabase) | Chi tiết mục tiêu |
| Hạn chót | `goals.due_date` (Supabase) | Ngày đến hạn |
| Trạng thái | `goals.completed` (Supabase) | Hoàn thành hay chưa |
| Ngày hoàn thành | `goals.completed_at` (Supabase) | Thờii điểm hoàn thành |

### 5.2 Cấu trúc bảng
```sql
-- Bảng: goals (migrations/phase1_goals.sql)
CREATE TABLE IF NOT EXISTS goals (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. Dữ liệu Nhà trị liệu (Therapist Data)

### 6.1 Therapist-Client Pairing
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Therapist ID | `therapist_clients.therapist_id` (Supabase) | ID nhà trị liệu |
| Client ID | `therapist_clients.client_id` (Supabase) | ID thân chủ |
| Trạng thái | `therapist_clients.status` (Supabase) | 'active', 'inactive' |
| Ngày ghép cặp | `therapist_clients.paired_at` (Supabase) | Thờii điểm ghép cặp |

### 6.2 Assignments (Bài tập)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Tiêu đề | `assignments.title` (Supabase) | Tên bài tập |
| Mô tả | `assignments.description` (Supabase) | Chi tiết bài tập |
| Hạn nộp | `assignments.due_date` (Supabase) | Ngày đến hạn |
| Trạng thái | `assignments.status` (Supabase) | 'pending', 'completed' |
| Ghi chú hoàn thành | `assignments.completion_notes` (Supabase) | Ghi chú khi hoàn thành |
| Ngày hoàn thành | `assignments.completed_at` (Supabase) | Thờii điểm hoàn thành |

### 6.3 Crisis Events (Sự kiện khủng hoảng)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Crisis level | `crisis_events.crisis_level` (Supabase) | Mức độ: low/medium/high/critical |
| Message snippet | `crisis_events.message_snippet` (Supabase) | Đoạn tin nhắn cảnh báo |
| Acknowledged | `crisis_events.acknowledged` (Supabase) | NTL đã xem hay chưa |
| Therapist notes | `crisis_events.therapist_notes` (Supabase) | Ghi chú của NTL |

### 6.4 Cấu trúc bảng
```sql
-- Bảng: therapist_clients (trong therapist_service.py)
CREATE TABLE IF NOT EXISTS therapist_clients (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    client_id TEXT REFERENCES users(id),
    paired_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'active',
    UNIQUE(therapist_id, client_id)
);

-- Bảng: assignments (trong therapist_service.py)
CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    therapist_id UUID REFERENCES therapists(id),
    client_id TEXT REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE,
    status TEXT DEFAULT 'pending',
    completion_notes TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng: crisis_events (trong therapist_service.py)
CREATE TABLE IF NOT EXISTS crisis_events (
    id SERIAL PRIMARY KEY,
    client_id TEXT REFERENCES users(id),
    therapist_id UUID REFERENCES therapists(id),
    crisis_level TEXT NOT NULL,
    message_snippet TEXT,
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    therapist_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. Dữ liệu Push Notifications

### 7.1 Push Subscriptions
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Endpoint | `push_subscriptions.endpoint` (Supabase) | URL endpoint cho push |
| P256dh key | `push_subscriptions.p256dh` (Supabase) | Public key |
| Auth key | `push_subscriptions.auth` (Supabase) | Authentication secret |

### 7.2 Cấu trúc bảng
```sql
-- Bảng: push_subscriptions (migrations/phase1_goals.sql)
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. Dữ liệu Local (Browser Storage)

### 8.1 LocalStorage (PWA)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Session token | `localStorage.access_token` | JWT token |
| User info | `localStorage.user` | Thông tin user cơ bản |
| Theme preference | `localStorage.theme` | Giao diện sáng/tối |
| Language | `localStorage.language` | Ngôn ngữ ưu tiên |

### 8.2 IndexedDB (PWA)
| Loại dữ liệu | Vị trí lưu trữ | Mô tả |
|-------------|----------------|-------|
| Offline messages | IndexedDB | Tin nhắn khi offline |
| Cached data | IndexedDB | Dữ liệu cache cho PWA |

---

## 9. Tổng kết

### Sơ đồ quan hệ dữ liệu

```
users (core)
├── chat_messages (n-1)
├── session_summaries (n-1)
│   └── chat_messages (n-1)
├── analyzed_sessions (n-1)
├── journal_entries (n-1)
├── goals (n-1)
├── therapist_clients (n-1) → therapists
├── assignments (n-1)
├── crisis_events (n-1)
└── push_subscriptions (n-1)

memories (Mem0 vector store)
└── metadata.user_id → users.id
```

### Các service liên quan

| Service | File | Chức năng |
|---------|------|-----------|
| DatabaseManager | `database.py` | Quản lý Supabase |
| MemoryService | `memory_service.py` | Mem0 integration |
| TherapistService | `therapist_service.py` | Quản lý NTL |
| AuthManager | `auth_manager.py` | Xác thực |
| FactsParser | `facts_parser.py` | Parse facts.txt |

### Lưu ý bảo mật

1. **Dữ liệu nhạy cảm**: Medical profiles, session notes cần mã hóa
2. **Audit log**: Theo dõi truy cập dữ liệu thân chủ
3. **RLS policies**: Row Level Security trong Supabase
4. **Data retention**: Xóa dữ liệu sau thờii gian quy định
