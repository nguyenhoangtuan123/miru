# Implementation Plan: Unified Proactive Chat Agent 🤖💬

## Goal
Thay thế logic tạo tin nhắn chủ động cũ (rule-based/simple LLM) bằng **Main Chat Agent** (`agent_graph.py`).
Điều này đảm bảo AI "nhắn tin trước" vẫn giữ đúng tính cách, nhớ ngữ cảnh (Mem0, Facts) và dùng model/luồng xử lý giống hệt khi chat bình thường.

## User Request
*   Sử dụng luồng chat và model của chat chính.
*   Nhận thức được thời gian không hoạt động.
*   Sử dụng toàn bộ dữ liệu (context, history) của luồng chat.

---

## Proposed Changes

### 1. Modify `proactive_routes.py`
Thay thế hoàn toàn logic trong endpoint `/check`.

#### Logic Mới:
1.  **Check Inactivity**: Giữ nguyên logic kiểm tra thời gian (tính `inactive_days` hoặc `hours`).
2.  **Construct System Trigger**:
    *   Thay vì gọi `proactive_service`, gọi `agent_graph.run_agent`.
    *   **Fake User Message**: Tạo một "trigger prompt" đặc biệt gửi vào agent.
    *   *Prompt Pattern*:
        ```text
        [SYSTEM EVENT: USER INACTIVE FOR 3 DAYS]
        User has not interacted for 3 days. Based on their memories and recent session facts, generate a warm, short proactive check-in message.
        - If they had an open problem, ask about it.
        - If not, just say hello warmly.
        - Keep it under 2 sentences.
        ```
3.  **Run Agent**:
    *   Gọi `run_agent(user_id, trigger_prompt, ...)`
    *   Agent sẽ tự động:
        *   Detect Crisis (Skip if trigger, or handle safely).
        *   Retrieve Memory (Mem0) -> Tìm thông tin liên quan đến user.
        *   Generate Response (Gemini) -> Sinh câu chào hỏi đúng context.
4.  **Formatting**:
    *   Lấy `response` từ agent.
    *   Trả về format JSON mà frontend `chat.js` mong đợi (`notifications` array).

### 2. Frontend (`pwa/js/chat.js`)
*   Không cần sửa nhiều vì API response format sẽ được giữ nguyên (hoặc map lại).
*   Hiện tại frontend mong đợi:
    ```json
    {
        "notifications": [
            { "message": "...", "type": "...", "actions": [...] }
        ]
    }
    ```

### 3. Cleanup
*   Có thể deprecate `proactive_service.py` dần dần hoặc giữ lại các hàm utility (tính toán time diff).

## Verification Plan

### Automated/Manual Tests
1.  **Trigger Test via API**:
    *   Dùng `curl` hoặc `Postman` gọi `POST /api/proactive/check` với `last_active` cũ (ví dụ: 3 ngày trước).
    *   **Expect**: Nhận được JSON chứa message dài, có chiều sâu (do Main Agent sinh ra), thay vì các câu template cũ.
    *   **Log Check**: Kiểm tra terminal xem `[Memory Node]` có được kích hoạt không.

2.  **Context Test**:
    *   Chat với AI vài câu: "Tôi tên là Huy, đang buồn vì mất việc".
    *   Chờ (hoặc fake `last_active` trong request API).
    *   Gọi API check.
    *   **Expect**: Message proactive có nhắc đến việc "buồn" hoặc "tìm việc" (nếu Agent hoạt động đúng).

## Files to Modify
*   [MODIFY] `proactive_routes.py`
*   [READ ONLY] `agent_graph.py` (Reused)
*   [READ ONLY] `chat_manager.py` (Reused for history if needed)
