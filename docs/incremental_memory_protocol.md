# Giao thức Bộ nhớ Ngắn hạn Tăng trưởng (Incremental Fact Extraction Protocol)

**Tác giả:** [Tên Dự án/User]
**Phiên bản:** 1.0
**Mục đích:** Tối ưu hóa bộ nhớ ngắn hạn (Short-term context) cho các hệ thống AI hội thoại chuyên sâu, giảm thiểu chi phí token nhưng vẫn duy trì sự thấu hiểu sâu sắc (Deep Context Awareness).

---

## 1. Vấn đề (The Problem)

Các hệ thống AI truyền thống thường gặp hai vấn đề lớn về bộ nhớ:
1.  **Tràn Context (Context Overflow):** Nếu nạp toàn bộ lịch sử chat vào prompt, chi phí token tăng phi mã và dễ chạm giới hạn context window.
2.  **Mất Mát Thông Tin (Information Loss):** Nếu chỉ giữ lại $N$ tin nhắn gần nhất (Sliding Window), AI sẽ quên các chi tiết quan trọng mà user đã nói từ đầu buổi (ví dụ: tên, vai trò, nỗi đau cốt lõi).

## 2. Giải pháp: Incremental Fact Extraction

Thay vì lưu trữ *nguyên văn* hội thoại, phương pháp này sử dụng một quy trình nền (background process) để **liên tục trích xuất và cô đọng** các sự kiện (facts) quan trọng vào một "Báo cáo sống" (Live Report).

### Cơ chế hoạt động:

1.  **Input:** User gửi tin nhắn -> AI trả lời.
2.  **Parallel Processing (Xử lý song song):**
    *   Trong khi AI trả lời user, một luồng (thread) ngầm được kích hoạt.
    *   Luồng này gọi một model LLM nhỏ/nhanh (ví dụ: Gemini Flash hoặc model 8B) với vai trò là "Nhà Nghiên Cứu" (Researcher).
3.  **Extraction (Trích xuất):**
    *   Input cho Researcher: *Hồ sơ hiện tại* + *Cặp hội thoại mới nhất*.
    *   Nhiệm vụ: "Hãy cập nhật hồ sơ này dựa trên thông tin mới. Nếu không có gì mới, hãy bỏ qua."
4.  **Storage (Lưu trữ):**
    *   Kết quả được ghi đè hoặc nối (append) vào một file text nhẹ (`user_facts.txt`).
5.  **Injection (Tiêm context):**
    *   Ở lượt chat tiếp theo, AI chính (Main Agent) sẽ không chỉ nhận được lịch sử chat gần nhất, mà còn nhận được toàn bộ nội dung của `user_facts.txt` ở phần System Prompt.

## 3. Kiến trúc Kỹ thuật (Implementation Details)

### A. Cấu trúc dữ liệu ("Báo cáo sống")

File `_facts.txt` không lưu hội thoại, mà lưu Insights theo cấu trúc nghiệp vụ. Ví dụ với AI Consulting:

```text
1. [HỒ SƠ LÃNH ĐẠO]:
- CEO công ty Logistics 50 nhân sự.
- Phong cách quản lý vi mô (Micromanagement), hay lo lắng.

2. [VẤN ĐỀ HIỆN TẠI]:
- Nhân viên sales làm việc thiếu động lực.
- Quy trình duyệt chi đang bị tắc nghẽn ở khâu kế toán.

3. [CHIẾN LƯỢC ĐỀ XUẤT]:
- AI đã đề xuất mô hình khoán doanh số (User chưa đồng ý).
- Cần tập trung vào giải phóng quỹ thời gian cho CEO trước.
```

### B. Prompt cho Researcher (Trích xuất viên)

```python
PROMPT = f"""
BẠN LÀ MỘT NHÀ NGHIÊN CỨU TÂM LÝ.
Nhiệm vụ: Đọc hội thoại mới nhất và cập nhật "BÁO CÁO INSIGHT" hiện có.

[DỮ LIỆU HIỆN TẠI]
{current_facts}

[HỘI THOẠI MỚI]
User: {user_input}
AI: {ai_response}

YÊU CẦU:
- Chỉ trích xuất thông tin mới về: (1) Info User, (2) Vấn đề, (3) Tâm lý, (4) Quyết định.
- Nếu thông tin trùng lặp -> BỎ QUA.
- Nếu không có gì mới -> Trả về "NO_UPDATE".
"""
```

### C. Luồng xử lý (Pseudocode)

```python
def on_user_message(user_input):
    # 1. Main Agent trả lời (Ưu tiên tốc độ)
    response = main_agent.chat(history + read_file("facts.txt"))
    
    # 2. Background Task: Cập nhật bộ nhớ (Không block user)
    threading.Thread(target=update_facts, args=(user_input, response)).start()
    
    return response

def update_facts(user_input, ai_response):
    # Gọi Researcher Agent
    new_insights = researcher_llm.extract(current_facts, user_input, ai_response)
    
    if new_insights != "NO_UPDATE":
        write_file("facts.txt", new_insights)
```

## 4. Ứng dụng: Session Emotional Graph (Biểu đồ Cảm xúc Phiên)

Theo yêu cầu mới, mỗi phiên chat (Session) sẽ gắn liền với **duy nhất 1 file `facts.txt`**. File này không chỉ lưu thông tin tĩnh ngắt quãng, mà đóng vai trò như một **"Lịch trình theo dõi cảm xúc" (Emotional Timeline)** của user trong suốt phiên đó.

### Cấu trúc `facts.txt` cải tiến (Session Log)

Thay vì chỉ liệt kê gạch đầu dòng, file sẽ chia làm 2 phần:

#### Phần A: Context Tĩnh (Static Context)
*Những thông tin nền tảng ít thay đổi trong phiên.*
```text
[USER INFO]: Nam, 25 tuổi, Designer.
[GOAL]: Cần brainstorm ý tưởng cho poster Tết.
```

#### Phần B: Dòng chảy Cảm xúc (Emotional Flow)
*Cập nhật liên tục sau mỗi turn.*
```text
[TIMELINE]:
1. [User: Chào Miru] -> [Neutral]: Bắt đầu hội thoại.
2. [User: Tôi đang bí quá] -> [Anxious]: Stress nhẹ vì deadline.
3. [User: Ý tưởng này hay đấy!] -> [Excited]: Đã tìm ra hướng đi (Relief).
4. [User: Nhưng màu này hơi tối] -> [Concerned]: Lo ngại về chi tiết kỹ thuật.
```

### Lợi ích của Emotional Timeline:
1.  **AI nắm bắt "Nhịp điệu" (Pacing):** Thấy user đang "Excited" -> AI sẽ đẩy cao trào. Thấy user "Concerned" -> AI sẽ chậm lại, giải thích kỹ hơn.
2.  **Phát hiện bất thường:** Nếu user chuyển từ "Neutral" sang "Angry" đột ngột -> AI biết mình vừa nói sai, cần sửa sai ngay.
3.  **Tổng kết cuối phiên:** Dễ dàng tạo báo cáo: "Hôm nay bạn khởi đầu hơi lo lắng nhưng kết thúc rất hào hứng".

## 5. Kiến trúc Kỹ thuật (Implementation Details)

### Prompt cho Researcher (Trích xuất viên - Session Focus)

```python
PROMPT = f"""
BẠN LÀ CHUYÊN GIA TÂM LÝ & THƯ KÝ CỦA PHIÊN CHAT NÀY.
Nhiệm vụ: Cập nhật file "Session Log" dựa trên tin nhắn mới nhất.

[SESSION LOG HIỆN TẠI]
{current_facts}

[HỘI THOẠI MỚI NHẤT]
User: {user_input}
AI: {ai_response}

YÊU CẦU XỬ LÝ:
1. Cập nhật [USER INFO] hoặc [GOAL] nếu có thông tin mới về danh tính/mục tiêu.
2. Thêm 1 dòng vào [TIMELINE] mô tả diễn biến tâm lý mới nhất của User.
   - Format: `N. [Snippet câu nói] -> [Emotion Label]: Lý do/Diễn biến.`
3. Giữ nguyên các dòng cũ trong Timeline để đảm bảo tính lịch sử.
"""
```

### Luồng xử lý (Code Flow)

Cấu trúc file hệ thống sẽ quản lý theo Session ID:

```
/memories
  /session_12345
    - facts.txt  (File này được load vào System Prompt mỗi lần chat)
    - chat_log.json (Lưu full history để backup)
```

Quá trình `update_facts` sẽ chạy ngầm (Background Worker) sử dụng model nhẹ (Gemini Flash 8B) để đảm bảo chi phí thấp và tốc độ cao.

