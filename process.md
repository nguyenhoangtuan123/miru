# Miru Development Progress

## Phiên làm việc: 31/12/2024

### ✅ Đã hoàn thành

#### 1. Knowledge Graph Visualization
- Node shapes: Tròn, màu sắc theo type (preference, emotion, person, goal)
- Click handler: Bấm node hiển thị chi tiết đầy đủ
- Zoom controls: +/- và Fit button
- Khung graph: Aspect-square, 500-700px

#### 2. Insights Page Dynamic
- **Thay SVG hardcoded bằng Chart.js** - Chart động load từ API
- API `/api/insights/analysis/{user_id}` - Energy Level, Emotion Spectrum, AI Summary, Patterns
- Date selector (Weekly/Monthly/Yearly) hoạt động

#### 3. Proactive AI Notifications
- Kích hoạt proactive_service.py
- Widget "Miru nhắn bạn" trên app.html
- Load từ `/api/proactive/daily-message/{user_id}`
- Dismiss button với sessionStorage

#### 4. Therapist Dashboard
- Backend routes + service đã có đầy đủ
- ⚠️ **CẦN TẠO TABLES** trong Supabase (xem `therapist_service.py` dòng 245-296)

#### 5. Settings Page Persistence
- Toggle Notifications lưu vào localStorage
- Toggle Dark Mode lưu và áp dụng ngay
- Chỉnh sửa tên hiển thị auto-save
- Therapist Connect button hoạt động
- Delete All Memories với modal xác nhận

#### 6. Orb Page → Breathing Exercise
- Chuyển từ voice input thành bài tập thở
- Kỹ thuật 4-4-6-2 (hít vào-giữ-thở ra-giữ)
- Animation orb scale theo nhịp thở
- 5 vòng với progress tracking
- Vibration feedback trên mobile

#### 7. Goals Widget (PHASE 1 - NEW)
- Widget "Mục tiêu" trên Dashboard
- CRUD APIs: `/api/goals`
- Toggle complete với animation
- Due date support
- ⚠️ **CẦN CHẠY SQL**: `migrations/phase1_goals.sql`

#### 8. Push Notifications (PHASE 1 - NEW)
- Service Worker push event handler
- Native notification với vibration
- Click → mở app
- Permission request khi đăng nhập

---

## Phiên làm việc: 29/12/2024

### ✅ Đã hoàn thành

#### 1. Chat Sessions & History
- **Backend APIs** (`pwa_server.py`):
  - `GET /api/chat/sessions/{user_id}` - Danh sách sessions
  - `POST /api/chat/sessions/{user_id}` - Tạo session mới
  - `DELETE /api/chat/sessions/{session_id}` - Xóa session
  - `POST /api/chat/sessions/{session_id}/generate-title` - AI tạo tên

- **Frontend** (`pwa/chat.html`):
  - Sidebar lịch sử (click ☰ để mở)
  - Nút "Cuộc trò chuyện mới"
  - Auto-create session khi chưa có
  - `saveCurrentSession()` gọi khi tạo mới

#### 2. AI Response Quality
- Fixed conversation history order: System → History → Current message
- Stable model: `llama-3.3-70b-versatile`
- Crisis detection keyword density check for long text
- Memory filtering for low-quality memories

#### 3. Memories Page (`pwa/memories.html`)
- ❌ Removed mock data (Nỗi sợ độ cao, Tiếng mưa đêm, etc.)
- ✅ Dynamic loading from API `/api/memories/{user_id}`
- ✅ Knowledge Graph tab - fixed `from`/`to` (không còn undefined)
- ✅ Timeline tab - thiết kế dạng cây với màu cảm xúc:
  - 🟡 Vui vẻ (amber)
  - 🔵 Buồn (blue)
  - 🔴 Stress/Lo âu (red)
  - 🟢 Bình yên (emerald)
- ✅ Memory list - fixed JSON parsing (không còn hiển thị raw JSON)

---

### ⚠️ Lưu ý cho AI tiếp theo

#### Cấu trúc dữ liệu quan trọng:
1. **Knowledge Graph edges** dùng `from`/`to`, KHÔNG phải `source`/`target`
2. **Memory list** có thể nhận JSON string trong field `memory` hoặc `text`
3. **Session metadata** được lưu dưới dạng JSON trong `summary_text` của bảng `session_summaries`

#### APIs cần biết:
- `/api/memories/{user_id}` - Danh sách memories từ Mem0
- `/api/memories/{user_id}/graph` - Knowledge Graph (nodes + edges)
- `/api/insights/timeline/{user_id}` - Timeline sessions
- `/api/insights/analysis/{user_id}` - Full insights analysis
- `/api/proactive/daily-message/{user_id}` - AI daily message
- `/api/chat/sessions/{user_id}` - Chat sessions list
- `/api/therapist/*` - Therapist dashboard APIs

---

### 🐛 Known Issues
- Database connection timeout (Supabase) - cần restart server nếu gặp
- Mem0 fact extraction đôi khi lưu facts không cần thiết
- Therapist tables chưa được tạo trong Supabase

