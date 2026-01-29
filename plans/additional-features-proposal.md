# Đề xuất Tính năng Bổ sung cho App Miru

## Tổng quan App Hiện tại

Miru là một AI Chatbot với bộ nhớ dài hạn, bao gồm:
- 💬 Chat với AI (WebSocket real-time)
- 🧠 Knowledge Graph (vis-network visualization)
- 📊 Emotion Dashboard (Chart.js)
- 📝 Journal (Nhật ký cảm xúc)
- 🎯 Goals (Mục tiêu)
- 👨‍⚕️ Therapist Connect (Kết nối chuyên gia)
- 📱 PWA (Progressive Web App)

---

## 🎯 Đề xuất Tính năng Mới

### 1. **Voice Chat (Chat bằng giọng nói)**

**Mô tả:** Cho phép người dùng nói tin nhắn thay vì gõ.

**Lợi ích:**
- Tăng trải nghiệm người dùng
- Hỗ trợ người dùng khi không tiện gõ
- Phù hợp với mobile

**Kỹ thuật:**
```javascript
// Web Speech API
const recognition = new webkitSpeechRecognition();
recognition.lang = 'vi-VN';
recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    sendMessage(text);
};
```

**Priority:** ⭐⭐⭐ (Cao)

---

### 2. **Mood Check-in Hàng ngày**

**Mô tả:** Nhắc nhở người dùng check-in cảm xúc mỗi ngày.

**Lợi ích:**
- Theo dõi sức khỏe tinh thần
- Tạo thói quen tự chăm sóc
- Dữ liệu cho insights

**UI:** 
- Notification vào 8h sáng hàng ngày
- Chọn emoji cảm xúc
- Thêm ghi chú ngắn

**Priority:** ⭐⭐⭐ (Cao)

---

### 3. **Chat Group/Hội nhóm**

**Mô tả:** Hỗ trợ nhiều người dùng trong cùng một cuộc hội thoại.

**Lợi ích:**
- Phù hợp cho gia đình, nhóm bạn
- Chia sẻ AI với nhau
- Phân tích dynamics nhóm

**Kỹ thuật:**
- Thêm `group_id` vào session
- Quản lý permissions
- AI context cho multiple users

**Priority:** ⭐⭐ (Trung bình)

---

### 4. **AI-generated Summary (Tóm tắt cuộc hội thoại)**

**Mô tả:** Tự động tạo summary sau mỗi cuộc hội thoại.

**Lợi ích:**
- Người dùng nhanh chóng xem lại nội dung
- Lưu vào memories
- Hỗ trợ tìm kiếm

**Kỹ thuật:**
```python
async def generate_summary(messages: list) -> str:
    # Sử dụng LLM để tóm tắt
    prompt = f"Tóm tắt cuộc trò chuyện sau:\n{messages}"
    return llm.invoke(prompt)
```

**Priority:** ⭐⭐⭐ (Cao)

---

### 5. **Quote/Insight Cards**

**Mô tả:** AI tạo các card trích dẫn, insight từ cuộc hội thoại.

**Lợi ích:**
- Chia sẻ lên mạng xã hội
- Động lực hàng ngày
- Lưu trữ những khoảnh khắc quan trọng

**UI:**
- Card đẹp có thể tải về
- Nhiều themes

**Priority:** ⭐⭐ (Trung bình)

---

### 6. **Search trong Chat History**

**Mô tả:** Tìm kiếm tin nhắn cũ theo từ khóa.

**Lợi ích:**
- Nhanh chóng tìm lại thông tin
- Tận dụng bộ nhớ
- Tiện lợi cho người dùng

**Kỹ thuật:**
- Full-text search trong chat_messages
- Highlight kết quả
- Filter theo ngày

**Priority:** ⭐⭐⭐ (Cao)

---

### 7. **Export Data (Xuất dữ liệu)**

**Mô tả:** Cho phép người dùng xuất chat history, journal ra file.

**Lợi ích:**
- Backup cá nhân
- GDPR compliance
- Chia sẻ với chuyên gia

**Định dạng:**
- JSON (đầy đủ)
- PDF (đẹp, in được)
- Markdown (đọc được)

**Priority:** ⭐⭐⭐ (Cao)

---

### 8. **Reminders/Thông báo nhắc nhở**

**Mô tả:** Đặt reminder từ trong chat.

**Lợi ích:**
- AI nhắc nhở công việc
- Tích hợp calendar
- Tự động follow-up

**Ví dụ:** "Nhắc tôi gọi cho mẹ vào tối nay"

**Priority:** ⭐⭐ (Trung bình)

---

### 9. **Multi-language Support**

**Mô tả:** Hỗ trợ nhiều ngôn ngữ.

**Lợi ích:**
- Mở rộng thị trường
- Hỗ trợ người dùng quốc tế
- Language detection tự động

**Implementation:**
- i18n framework
- Translations JSON
- Detect user language

**Priority:** ⭐ (Thấp - nếu chỉ focus VN)

---

### 10. **Dark/Light Theme Toggle**

**Mô tả:** Chuyển đổi giữa dark và light mode.

**Lợi ích:**
- Thị hiếu người dùng
- Giảm mỏi mắt
- Tiết kiệm pin (OLED)

**Priority:** ⭐⭐ (Trung bình)

---

## 📊 Bảng Ưu tiên

| Tính năng | Impact | Effort | Priority |
|-----------|--------|--------|----------|
| Voice Chat | Cao | Cao | ⭐⭐⭐ |
| Mood Check-in | Cao | Thấp | ⭐⭐⭐ |
| AI Summary | Cao | Trung bình | ⭐⭐⭐ |
| Search History | Cao | Thấp | ⭐⭐⭐ |
| Export Data | Cao | Trung bình | ⭐⭐⭐ |
| Quote Cards | Trung bình | Trung bình | ⭐⭐ |
| Reminders | Trung bình | Trung bình | ⭐⭐ |
| Theme Toggle | Trung bình | Thấp | ⭐⭐ |
| Chat Group | Cao | Cao | ⭐⭐ |
| Multi-language | Thấp | Cao | ⭐ |

---

## 🎯 Đề xuất Triển khai theo Phase

### Phase 1 (Dễ, Impact cao):
1. Dark/Light Theme Toggle
2. Mood Check-in Notifications
3. Search trong Chat History

### Phase 2 (Trung bình):
1. AI-generated Summary
2. Export Data (JSON/PDF)
3. Quote Cards

### Phase 3 (Phức tạp):
1. Voice Chat
2. Chat Group
3. Reminders System

---

## 💡 Ý tưởng Khác

- **Voice clone**: AI nói lại câu trả lời bằng giọng người dùng
- **Mood-based music**: Đề xuất nhạc theo cảm xúc
- **Dream journal**: Ghi giấc mơ
- **Gratitude journal**: Nhật ký biết ơn
- **Meditation guides**: Hướng dẫn thiền
- **Crisis detection nâng cao**: AI phát hiện sớm dấu hiệu
- **Integration với wearables**: Apple Watch, Fitbit
- **Calendar sync**: Google Calendar, Outlook
