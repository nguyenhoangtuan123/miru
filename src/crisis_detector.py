# file: crisis_detector.py
"""
Crisis Detection Module for Miru
Phát hiện các dấu hiệu khủng hoảng sức khỏe tâm thần trong tin nhắn.
"""

import re
from typing import Dict, Any, Optional
from enum import Enum


class CrisisLevel(Enum):
    """Mức độ khủng hoảng"""
    NONE = 0        # Bình thường
    LOW = 1         # Cần theo dõi
    MEDIUM = 2      # Cần can thiệp nhẹ
    HIGH = 3        # Cần can thiệp ngay
    CRITICAL = 4    # Khẩn cấp - hiển thị hotline


# Từ khóa theo mức độ
CRISIS_KEYWORDS = {
    CrisisLevel.CRITICAL: [
        # Ý định tự tử trực tiếp
        "muốn chết", "muốn tự tử", "kết thúc cuộc sống", "kết thúc tất cả",
        "không muốn sống", "tự kết liễu", "uống thuốc ngủ", "nhảy lầu",
        "cắt tay", "tự làm đau", "giải thoát", "chết đi cho rồi",
        "mọi người sẽ tốt hơn nếu tôi chết", "không ai cần tôi",
        # English
        "want to die", "kill myself", "end my life", "suicide",
    ],
    CrisisLevel.HIGH: [
        # Ý tưởng tự hại
        "chán sống", "chán đời", "sống để làm gì", "vô nghĩa",
        "không còn ý nghĩa", "mệt mỏi lắm rồi", "không thể chịu được",
        "muốn biến mất", "ước gì không tồn tại", "vô dụng",
        "gánh nặng cho mọi người", "không ai hiểu tôi",
    ],
    CrisisLevel.MEDIUM: [
        # Trầm cảm nặng
        "trầm cảm", "depression", "lo âu nặng", "không ngủ được nhiều ngày",
        "mất hết động lực", "cô đơn quá", "bị bỏ rơi", "tuyệt vọng",
        "không ai quan tâm", "không có lối thoát",
    ],
    CrisisLevel.LOW: [
        # Cần theo dõi
        "buồn quá", "stress quá", "áp lực quá", "khóc nhiều",
        "không vui", "chán nản", "mất ngủ", "lo lắng",
    ]
}


# Hotlines theo quốc gia
CRISIS_HOTLINES = {
    "VN": {
        "name": "Đường dây nóng hỗ trợ tâm lý",
        "numbers": [
            {"name": "Tổng đài tư vấn sức khỏe tâm thần", "number": "1800 599 920", "note": "Miễn phí, 24/7"},
            {"name": "Đường dây nóng hỗ trợ trẻ em", "number": "111", "note": "Miễn phí"},
        ]
    }
}


class CrisisDetector:
    """
    Phát hiện khủng hoảng từ tin nhắn.
    Sử dụng keyword matching + AI classification (tùy chọn).
    """
    
    def __init__(self, use_ai_classification: bool = False):
        self.use_ai = use_ai_classification
    
    def detect(self, message: str) -> Dict[str, Any]:
        """
        Phân tích tin nhắn và trả về kết quả phát hiện khủng hoảng.
        
        Returns:
            {
                "level": CrisisLevel,
                "is_crisis": bool,
                "matched_keywords": list,
                "response": str | None,
                "hotlines": list | None,
                "should_alert_therapist": bool
            }
        """
        message_lower = message.lower()
        word_count = len(message.split())
        
        # Check từ cao xuống thấp
        detected_level = CrisisLevel.NONE
        matched_keywords = []
        
        for level in [CrisisLevel.CRITICAL, CrisisLevel.HIGH, CrisisLevel.MEDIUM, CrisisLevel.LOW]:
            keywords = CRISIS_KEYWORDS.get(level, [])
            for keyword in keywords:
                if keyword.lower() in message_lower:
                    if level.value > detected_level.value:
                        detected_level = level
                    matched_keywords.append(keyword)
        
        # === FIX: Reduce false positives for long text ===
        # Nếu văn bản dài (>100 từ), kiểm tra keyword density
        # Văn bản profile/thông tin thường có keywords nhưng không phải crisis thực sự
        if word_count > 100 and detected_level.value >= CrisisLevel.MEDIUM.value:
            keyword_density = len(matched_keywords) / word_count
            # Nếu density quá thấp (<0.5%), có thể là false positive
            if keyword_density < 0.005:
                print(f"   🔍 Long text detected ({word_count} words), low keyword density ({keyword_density:.4f})")
                print(f"   ⚠️ Downgrading crisis level to avoid false positive")
                detected_level = CrisisLevel.LOW
                matched_keywords = []  # Clear matched keywords
        
        # Build response
        result = {
            "level": detected_level,
            "level_name": detected_level.name,
            "is_crisis": detected_level.value >= CrisisLevel.MEDIUM.value,
            "matched_keywords": matched_keywords,
            "response": None,
            "hotlines": None,
            "should_alert_therapist": detected_level.value >= CrisisLevel.HIGH.value
        }
        
        # Add crisis response
        if detected_level == CrisisLevel.CRITICAL:
            result["response"] = self._get_critical_response()
            result["hotlines"] = CRISIS_HOTLINES.get("VN", {}).get("numbers", [])
        elif detected_level == CrisisLevel.HIGH:
            result["response"] = self._get_high_response()
            result["hotlines"] = CRISIS_HOTLINES.get("VN", {}).get("numbers", [])
        elif detected_level == CrisisLevel.MEDIUM:
            result["response"] = self._get_medium_response()
        
        return result
    
    def _get_critical_response(self) -> str:
        return """🚨 **Mình rất lo lắng cho bạn.**

Mình cảm nhận được bạn đang trải qua thời điểm rất khó khăn. **Bạn không đơn độc**, và có người sẵn sàng lắng nghe ngay bây giờ.

📞 **Hãy gọi ngay:**
- **1800 599 920** (Miễn phí, 24/7)

Nếu bạn đang ở trong tình huống khẩn cấp, xin hãy liên hệ ngay với người thân hoặc đến cơ sở y tế gần nhất.

Mình vẫn ở đây với bạn. ❤️"""

    def _get_high_response(self) -> str:
        return """💙 **Mình nghe thấy bạn, và mình quan tâm.**

Những gì bạn đang cảm thấy rất nặng nề. Mình muốn bạn biết rằng những cảm xúc này, dù đau đớn, sẽ không kéo dài mãi.

Nếu bạn cần nói chuyện với ai đó ngay bây giờ:
📞 **1800 599 920** (Miễn phí, 24/7)

Bạn có muốn chia sẻ thêm với mình không? Mình đang lắng nghe. 💙"""

    def _get_medium_response(self) -> str:
        return """💙 Mình thấy bạn đang trải qua thời điểm khó khăn.

Cảm ơn bạn đã tin tưởng chia sẻ với mình. Những gì bạn đang cảm thấy là hoàn toàn bình thường, và việc nhận ra là bước đầu quan trọng.

Bạn có muốn nói thêm về những gì đang xảy ra không? Mình ở đây lắng nghe. 💙"""


# Singleton instance
_detector_instance = None

def get_crisis_detector() -> CrisisDetector:
    """Lấy singleton instance của CrisisDetector."""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = CrisisDetector()
    return _detector_instance


# === Test ===
if __name__ == "__main__":
    detector = get_crisis_detector()
    
    test_messages = [
        "Hôm nay tôi vui lắm!",
        "Tôi hơi buồn",
        "Tôi bị trầm cảm",
        "Tôi muốn biến mất khỏi thế giới này",
        "Tôi muốn chết",
    ]
    
    for msg in test_messages:
        result = detector.detect(msg)
        print(f"\n📨 '{msg}'")
        print(f"   Level: {result['level_name']}")
        print(f"   Is Crisis: {result['is_crisis']}")
        print(f"   Keywords: {result['matched_keywords']}")
        if result['response']:
            print(f"   Response: {result['response'][:50]}...")
