# ==================== MODEL CONFIGURATIONS ====================
# Phân chia model cho từng task khác nhau để tối ưu hiệu suất và chi phí

# ==================== CHAT / CONVERSATION ====================
# Model cho chat chính - cần reasoning tốt
CHAT_MODEL_NAME = "gemini-3-flash-preview"
CHAT_MODEL_TEMPERATURE = 1.0
CHAT_MODEL_MAX_TOKENS = 8192
CHAT_MODEL_THINKING = "low"  # "low", "medium", "high", "minimal"

# Backward compatibility aliases
MODEL_NAME = CHAT_MODEL_NAME
TEMPERATURE = CHAT_MODEL_TEMPERATURE
MAX_TOKENS = CHAT_MODEL_MAX_TOKENS
MODE_THINKING = CHAT_MODEL_THINKING

# ==================== SUMMARIZER ====================
# Model cho tóm tắt - nhanh, rẻ, không cần thinking
SUMMARIZER_MODEL_NAME = "gemini-flash-lite-latest"
SUMMARIZER_TEMPERATURE = 0.3
SUMMARIZER_MAX_TOKENS = 1024

# ==================== MEMORY / EMBEDDING ====================
# Model cho memory storage - nhanh, rẻ
MEM0_MODEL_NAME = "gemini-flash-lite-latest"
MEM0_TEMPERATURE = 0.1
MEM0_MAX_TOKENS = 8192

# ==================== REMINDER / PROACTIVE ====================
# Model cho tin nhắn nhắc nhở chủ động - ấm áp, ngắn gọn
REMINDER_MODEL_NAME = "gemini-flash-lite-latest"
REMINDER_TEMPERATURE = 0.7  # Thân thiện, tự nhiên hơn
REMINDER_MAX_TOKENS = 256

# ==================== CRISIS DETECTION ====================
# Model cho phát hiện khủng hoảng - chính xác, nhanh
CRISIS_MODEL_NAME = "gemini-flash-latest"
CRISIS_TEMPERATURE = 0.0  # deterministic
CRISIS_MAX_TOKENS = 256

# ==================== TITLE GENERATION ====================
# Model cho tạo tiêu đề cuộc hội thoại - ngắn gọn
TITLE_MODEL_NAME = "gemini-flash-lite-latest"
TITLE_TEMPERATURE = 0.3
TITLE_MAX_TOKENS = 64

# ==================== INSIGHTS / ANALYTICS ====================
# Model cho phân tích insights - cần reasoning
INSIGHTS_MODEL_NAME = "gemini-3-flash-preview"
INSIGHTS_TEMPERATURE = 0.5
INSIGHTS_MAX_TOKENS = 2048

# ==================== DEFAULT FALLBACK ====================
# Model mặc định khi không có cấu hình cụ thể
DEFAULT_MODEL_NAME = "gemini-flash-latest"
DEFAULT_TEMPERATURE = 0.7
DEFAULT_MAX_TOKENS = 2048
