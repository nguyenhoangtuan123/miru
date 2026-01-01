# analyzer.py - AI-powered conversation analyzer
"""
Separate AI service for analyzing conversations.
Uses Gemini Flash Lite to extract emotions, topics, and insights.
Runs independently from the chat AI.
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

# Configure Gemini for ANALYSIS (separate from chat AI)
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)

# Analyzer-specific model configuration
ANALYZER_MODEL = "gemini-flash-lite-latest"
ANALYZER_CONFIG = {
    "temperature": 0.3,  # Lower temp for consistent structured output
    "top_p": 0.8,
    "top_k": 20,
    "max_output_tokens": 500,
}

# Analysis prompt template
ANALYSIS_PROMPT = """Bạn là chuyên gia phân tích tâm lý. Phân tích cuộc trò chuyện sau và trích xuất thông tin có cấu trúc.

CUỘC TRÒ CHUYỆN:
{conversation_text}

Hãy phân tích và trả về JSON với format SAU ĐÂY (chỉ JSON, không giải thích):

{{
  "emotion_score": <số từ 1-10, 10 là rất tích cực>,
  "dominant_emotion": "<vui|buồn|lo_lắng|bình_thường|tức_giận|hạnh_phúc>",
  "topics": ["<chủ_đề_1>", "<chủ_đề_2>", "<chủ_đề_3>"],
  "key_moments": [
    {{"text": "<câu quan trọng nhất>", "importance": <1-10>}}
  ],
  "summary": "<tóm tắt 1-2 câu về nội dung chính>",
  "title": "<tiêu đề ngắn gọn, hấp dẫn, max 50 ký tự>"
}}

QUY TẮC:
- emotion_score: Đánh giá tổng thể (1=rất tiêu cực, 5=trung lập, 10=rất tích cực)
- dominant_emotion: Cảm xúc chủ đạo trong cuộc trò chuyện
- topics: Tối đa 3 chủ đề (công_việc, gia_đình, sức_khỏe, mối_quan_hệ, tài_chính, học_tập, sở_thích)
- key_moments: 1-3 câu quan trọng nhất (importance: mức độ quan trọng)
- summary: Ngắn gọn, súc tích, nêu bật điểm chính
- title: Hấp dẫn, dễ nhớ, không quá 50 ký tự

CHỈ TRẢ VỀ JSON, KHÔNG THÊM TEXT NÀO KHÁC.
"""


class ConversationAnalyzer:
    """AI-powered conversation analyzer using Gemini"""
    
    def __init__(self):
        """Initialize analyzer with separate Gemini model"""
        self.model = genai.GenerativeModel(
            model_name=ANALYZER_MODEL,
            generation_config=ANALYZER_CONFIG,
            system_instruction="You are a psychology analysis expert. Extract structured insights from conversations. Always return valid JSON only."
        )
        print(f"✅ Analyzer initialized with {ANALYZER_MODEL}")
    
    async def analyze_conversation(self, conversation_text: str, max_retries: int = 3) -> Optional[Dict]:
        """
        Analyze a conversation and extract structured insights.
        
        Args:
            conversation_text: Raw conversation text
            max_retries: Number of retry attempts if parsing fails
            
        Returns:
            Dict with analysis results or None if failed
        """
        if not conversation_text or len(conversation_text.strip()) < 10:
            print("⚠️ Conversation too short to analyze")
            return None
        
        # Build prompt
        prompt = ANALYSIS_PROMPT.format(conversation_text=conversation_text[:2000])  # Limit to 2000 chars
        
        for attempt in range(max_retries):
            try:
                print(f"🔍 Analyzing conversation (attempt {attempt + 1}/{max_retries})...")
                
                # Call Gemini API
                response = await self.model.generate_content_async(prompt)
                
                # Extract JSON from response
                response_text = response.text.strip()
                
                # Remove markdown code blocks if present
                if response_text.startswith("```json"):
                    response_text = response_text[7:]
                if response_text.startswith("```"):
                    response_text = response_text[3:]
                if response_text.endswith("```"):
                    response_text = response_text[:-3]
                
                response_text = response_text.strip()
                
                # Parse JSON
                analysis = json.loads(response_text)
                
                # Validate required fields
                required_fields = ["emotion_score", "dominant_emotion", "topics", "summary", "title"]
                if not all(field in analysis for field in required_fields):
                    raise ValueError(f"Missing required fields in analysis")
                
                # Validate emotion_score range
                if not (1 <= analysis["emotion_score"] <= 10):
                    analysis["emotion_score"] = 5  # Default to neutral
                
                # Ensure topics is a list
                if not isinstance(analysis["topics"], list):
                    analysis["topics"] = []
                
                # Limit topics to 3
                analysis["topics"] = analysis["topics"][:3]
                
                print(f"✅ Analysis complete: {analysis['title']}")
                return analysis
                
            except json.JSONDecodeError as e:
                print(f"❌ JSON parse error (attempt {attempt + 1}): {e}")
                print(f"Response: {response_text[:200]}...")
                if attempt == max_retries - 1:
                    return self._fallback_analysis(conversation_text)
                await asyncio.sleep(1)  # Wait before retry
                
            except Exception as e:
                print(f"❌ Analysis error (attempt {attempt + 1}): {e}")
                if attempt == max_retries - 1:
                    return self._fallback_analysis(conversation_text)
                await asyncio.sleep(1)
        
        return None
    
    def _fallback_analysis(self, conversation_text: str) -> Dict:
        """
        Fallback analysis using simple heuristics if AI fails.
        """
        print("⚠️ Using fallback analysis (AI failed)")
        
        text_lower = conversation_text.lower()
        
        # Simple emotion detection
        positive_words = ['vui', 'hạnh phúc', 'tốt', 'yêu', 'thích']
        negative_words = ['buồn', 'lo lắng', 'stress', 'áp lực', 'khó khăn']
        
        positive_count = sum(1 for word in positive_words if word in text_lower)
        negative_count = sum(1 for word in negative_words if word in text_lower)
        
        if positive_count > negative_count:
            emotion_score = 7
            dominant_emotion = "vui"
        elif negative_count > positive_count:
            emotion_score = 4
            dominant_emotion = "lo_lắng"
        else:
            emotion_score = 5
            dominant_emotion = "bình_thường"
        
        # Simple topic detection
        topics = []
        if any(word in text_lower for word in ['công việc', 'deadline', 'dự án', 'sếp']):
            topics.append('công_việc')
        if any(word in text_lower for word in ['gia đình', 'bố', 'mẹ', 'con']):
            topics.append('gia_đình')
        if any(word in text_lower for word in ['sức khỏe', 'bệnh', 'mệt']):
            topics.append('sức_khỏe')
        
        if not topics:
            topics = ['tâm_trạng']
        
        return {
            "emotion_score": emotion_score,
            "dominant_emotion": dominant_emotion,
            "topics": topics[:3],
            "key_moments": [],
            "summary": conversation_text[:100] + "..." if len(conversation_text) > 100 else conversation_text,
            "title": "Phiên trò chuyện",
            "fallback": True
        }


# Global analyzer instance
_analyzer_instance = None

def get_analyzer() -> ConversationAnalyzer:
    """Get or create global analyzer instance"""
    global _analyzer_instance
    if _analyzer_instance is None:
        _analyzer_instance = ConversationAnalyzer()
    return _analyzer_instance


async def analyze_session(session_text: str) -> Optional[Dict]:
    """
    Convenience function to analyze a session.
    
    Args:
        session_text: Raw session text
        
    Returns:
        Analysis dict or None
    """
    analyzer = get_analyzer()
    return await analyzer.analyze_conversation(session_text)


# Test function
async def test_analyzer():
    """Test the analyzer with sample conversation"""
    sample_conversation = """
    User: Hôm nay mình cảm thấy rất stress vì deadline dự án
    AI: Mình hiểu bạn đang áp lực. Bạn có thể chia sẻ thêm về dự án không?
    User: Dự án phải nộp vào thứ 6 mà mình chưa làm xong
    AI: Bạn đã làm được bao nhiêu phần trăm rồi?
    User: Khoảng 60%, còn 40% nữa
    AI: Vậy là còn 2 ngày. Bạn có kế hoạch cụ thể chưa?
    """
    
    print("🧪 Testing analyzer...")
    result = await analyze_session(sample_conversation)
    
    if result:
        print("\n✅ Analysis result:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        print("\n❌ Analysis failed")


if __name__ == "__main__":
    # Run test
    asyncio.run(test_analyzer())
