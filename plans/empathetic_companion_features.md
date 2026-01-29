# Plan: The Empathetic Companion (Psychologist & Friend) 🧠❤️

## Goal
Biến AI thành một người bạn tri kỷ và một chuyên gia tâm lý thấu hiểu, không chỉ phản hồi thụ động mà còn chủ động quan tâm, ghi nhớ và tạo bất ngờ cho người dùng.
**Mục tiêu cốt lõi:** Bất ngờ (Surprise) - Thấu hiểu (Understand) - Đồng hành (Accompany).

## "Ingredients" (Nguyên liệu sẵn có)
1.  **`fact.txt`**: Dữ liệu sự kiện, thực tế tách biệt từng session.
2.  **Analysis Logs**: Lịch sử phân tích cảm xúc, tâm trạng.
3.  **Mem0**: Bộ nhớ dài hạn (User preferences, core beliefs, important people).

---

## 1. Feature: "The Connecting Dots" (Sự Thấu Hiểu Sâu Sắc)
*AI không chỉ nhớ, mà còn biết liên kết các sự kiện rời rạc để tìm ra quy luật tâm lý.*

### Concept
Khi người dùng gặp một vấn đề, AI sẽ không giải quyết nó như một sự kiện đơn lẻ. Nó sẽ quét lại quá khứ để tìm **Pattern (Mẫu hành vi)**.

### Implementation
- **Data Source**: `fact.txt` (tìm sự kiện tương tự), Analysis Logs (tìm cảm xúc tương tự).
- **Logic**:
    1.  User than phiền về "Áp lực công việc".
    2.  AI search Mem0/Facts: Tìm các lần "Áp lực" trước đây.
    3.  **Psychological Insight**: "Mình để ý thấy cứ mỗi lần chuẩn bị họp với [Person A] là bạn lại lo lắng. Lần trước bạn đã vượt qua bằng cách [Solution X]. Liệu lần này áp dụng lại được không?"
    4.  **Tech**: Semantic Search trên Mem0 kết hợp Time-series analysis trên Logs.

## 2. Feature: "Emotional Forecast" (Dự Báo Thời Tiết Tâm Hồn)
*Dự đoán trước "cơn bão" cảm xúc và chuẩn bị ô dù cho người dùng.*

### Concept
Thay vì chờ user buồn mới an ủi, AI dựa vào Analysis Logs để dự đoán xu hướng.

### Implementation
- **Data Source**: Analysis Logs (Time & Emotion Score).
- **Logic**:
    1.  Phân tích log thấy: User thường xuyên có chỉ số năng lượng thấp vào chiều Chủ Nhật (Sunday Blues).
    2.  **Proactive Action**: Chiều Chủ Nhật, AI tự động gửi message: *"Chiều Chủ Nhật thường hơi trầm lắng. Bạn có muốn nghe một bản nhạc lo-fi hay cùng mình lên kế hoạch nhen nhóm lửa cho tuần mới không?"*
- **Surprise Element**: User sẽ ngạc nhiên vì AI biết chính xác "điểm trũng" năng lượng của họ.

## 3. Feature: "The 'Open Loop' Keeper" (Người Đồng Hành Tận Tâm)
*Không để câu chuyện rơi vào quên lãng.*

### Concept
Những người bạn vô tâm thường quên điều bạn kể tuần trước. Người bạn tri kỷ thì không.

### Implementation
- **Data Source**: `fact.txt` (được gắn tag `TODO`, `UPCOMING`, `WAITING`).
- **Logic**:
    1.  User kể: "Thứ 6 này tớ phải đi khám răng". (Lưu vào `fact.txt` với metadata `date: Friday`).
    2.  Hệ thống `ProactiveService` quét các "Open Loops" (Vòng lặp chưa đóng).
    3.  Thứ 6 hoặc Thứ 7, AI hỏi: *"Hôm qua đi khám răng thế nào rồi? Có đau lắm không?"*
- **Psychological Effect**: Cảm giác được quan tâm chi tiết thực sự (Validation).

## 4. Feature: "Memory Lane Surprise" (Sự Bất Ngờ Ngọt Ngào)
*Khơi dậy niềm vui từ quá khứ vào những lúc bất ngờ nhất.*

### Concept
Vào những ngày bình thường (không có sự kiện gì), AI lục lại một ký ức đẹp (High Emotion Score).

### Implementation
- **Data Source**: Mem0 (tìm ký ức tích cực nhất), Analysis Logs (check nếu user đang không bận/stress).
- **Logic**:
    1.  Random trigger khi user idle.
    2.  AI: *"Tự nhiên mình nhớ lại lần bạn kể về chuyến đi Đà Lạt 3 tháng trước. Lúc đó bạn bảo cảm thấy 'tự do chưa từng thấy'. Hy vọng hôm nay bạn cũng tìm được một chút cảm giác đó nhé! 🌲"*
- **Surprise Element**: Sự ngẫu nhiên. Không ai ngờ AI lại "ngồi nghĩ vẩn vơ" về người dùng.

## 5. Feature: "Shadow Work Prompts" (Đào Sâu Tâm Lý)
*AI đóng vai trò nhà trị liệu, giúp user đối diện với phần sâu kín.*

### Concept
Sử dụng dữ liệu Fact để đặt câu hỏi tu từ, giúp user tự nhận thức (Self-awareness).

### Implementation
- **Data Source**: Tổng hợp `fact.txt` + Mem0 về Core Values.
- **Logic**:
    1.  User đang phân vân decision.
    2.  AI check Core Values trong Mem0 (ví dụ: User coi trọng "Tự do").
    3.  AI prompt: *"Bạn đang lo lắng về việc đổi việc. Nhưng hãy nhớ lại xem, giá trị cốt lõi của bạn là 'Tự do'. Liệu ở lại nơi cũ có đang đi ngược lại điều đó không?"*

## Technical Roadmap Update
1.  **Refine `ProactiveService`**:
    *   Thêm `ContextAwareScheduler`: Lên lịch check-in dựa trên sự kiện trong `fact.txt`.
    *   Thêm `EmotionTrendAnalyzer`: Phân tích Logs để trigger cảnh báo sớm.
2.  **Upgrade `Insights Router`**:
    *   API để query "Past Similar Events" (Sự kiện tương tự trong quá khứ).
3.  **UI/UX**:
    *   Hiển thị "Flashback Card" (Thẻ hồi ức) trên giao diện chat.

---
*Plan này biến dữ liệu khô khan (log, text) thành sự thấu cảm sống động.*
