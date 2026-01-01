# file: pattern_analyzer.py
"""
Pattern Analyzer Service
Phân tích patterns từ memories của user: 
- Emotional patterns (stress vào ngày nào)
- Topic frequency (hay nhắc đến gì)
- Contradiction detection
"""

import os
from datetime import datetime, timedelta
from typing import List, Dict, Any
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


class PatternAnalyzer:
    """Phân tích patterns từ memories"""
    
    def __init__(self):
        self.groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    def analyze_patterns(self, memories: List[Dict]) -> Dict[str, Any]:
        """
        Phân tích toàn diện patterns từ memories.
        
        Returns:
            {
                "emotional_patterns": [...],
                "frequent_topics": [...],
                "time_patterns": {...},
                "insights": [...]
            }
        """
        if not memories or len(memories) < 3:
            return {
                "emotional_patterns": [],
                "frequent_topics": [],
                "time_patterns": {},
                "insights": ["Chưa đủ dữ liệu để phân tích patterns (cần ít nhất 3 ký ức)"]
            }
        
        # Combine memories for analysis
        memories_text = "\n".join([
            f"[{m.get('created_at', 'N/A')}] {m.get('memory', m.get('text', ''))}"
            for m in memories[:50]  # Limit to 50
        ])
        
        prompt = f"""Phân tích các ký ức sau và tìm PATTERNS. Trả về JSON.

KÝ ỨC:
{memories_text}

Trả về JSON với format:
{{
  "emotional_patterns": [
    {{"pattern": "mô tả pattern", "frequency": "hàng ngày/hàng tuần/thỉnh thoảng", "trigger": "nguyên nhân nếu có"}}
  ],
  "frequent_topics": [
    {{"topic": "chủ đề", "count": số lần nhắc, "sentiment": "positive/negative/neutral"}}
  ],
  "time_patterns": {{
    "most_active_days": ["Thứ 2", "Thứ 5"],
    "mood_by_time": "sáng thường tích cực, tối hay buồn"
  }},
  "insights": [
    "Insight hữu ích cho người dùng"
  ],
  "contradictions": [
    {{"statement1": "nói A", "statement2": "nói ngược lại", "note": "giải thích"}}
  ]
}}

Chỉ trả về JSON, không giải thích."""

        try:
            response = self.groq.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse JSON
            import json
            import re
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                data = json.loads(json_match.group())
                return data
            
            return self._fallback_analysis(memories)
            
        except Exception as e:
            print(f"[PatternAnalyzer] Error: {e}")
            return self._fallback_analysis(memories)
    
    def _fallback_analysis(self, memories: List[Dict]) -> Dict[str, Any]:
        """Fallback khi AI không phân tích được"""
        # Simple keyword-based analysis
        topics = {}
        sentiments = {"positive": 0, "negative": 0, "neutral": 0}
        
        positive_words = ["thích", "yêu", "vui", "hạnh phúc", "tốt", "hay", "đẹp"]
        negative_words = ["ghét", "buồn", "chán", "khó", "tệ", "stress", "lo"]
        
        for m in memories:
            text = (m.get('memory', '') or m.get('text', '')).lower()
            
            # Count sentiments
            if any(w in text for w in positive_words):
                sentiments["positive"] += 1
            elif any(w in text for w in negative_words):
                sentiments["negative"] += 1
            else:
                sentiments["neutral"] += 1
        
        # Determine dominant sentiment
        dominant = max(sentiments, key=sentiments.get)
        
        insights = []
        if sentiments["negative"] > sentiments["positive"]:
            insights.append("Ký ức tiêu cực nhiều hơn tích cực - có thể cần chú ý đến sức khỏe tâm thần")
        elif sentiments["positive"] > sentiments["negative"]:
            insights.append("Ký ức tích cực chiếm đa số - bạn đang có tâm trạng ổn định")
        
        return {
            "emotional_patterns": [],
            "frequent_topics": [],
            "time_patterns": {},
            "insights": insights,
            "sentiment_summary": sentiments
        }
    
    def detect_contradictions(self, memories: List[Dict]) -> List[Dict]:
        """
        Phát hiện mâu thuẫn trong các ký ức.
        Ví dụ: "Thích ăn gà" vs "Ghét gà chiên"
        """
        if len(memories) < 5:
            return []
        
        memories_text = "\n".join([
            f"- {m.get('memory', m.get('text', ''))}"
            for m in memories[:30]
        ])
        
        prompt = f"""Tìm các câu nói MÂU THUẪN trong các ký ức sau:

{memories_text}

Nếu có mâu thuẫn, trả về JSON array:
[
  {{"statement1": "câu 1", "statement2": "câu mâu thuẫn", "explanation": "giải thích"}}
]

Nếu không có mâu thuẫn, trả về: []

Chỉ trả về JSON array."""

        try:
            response = self.groq.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=500
            )
            
            result_text = response.choices[0].message.content.strip()
            
            import json
            import re
            json_match = re.search(r'\[[\s\S]*\]', result_text)
            if json_match:
                return json.loads(json_match.group())
            return []
            
        except Exception as e:
            print(f"[PatternAnalyzer] Contradiction detection error: {e}")
            return []


# Singleton
_analyzer = None

def get_pattern_analyzer() -> PatternAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = PatternAnalyzer()
    return _analyzer


# Test
if __name__ == "__main__":
    analyzer = get_pattern_analyzer()
    
    test_memories = [
        {"memory": "Tên là Dương, 21 tuổi", "created_at": "2024-01-01"},
        {"memory": "Thích uống trà sữa", "created_at": "2024-01-02"},
        {"memory": "Ghét đi làm vào thứ 2", "created_at": "2024-01-03"},
        {"memory": "Hôm nay stress vì deadline", "created_at": "2024-01-04"},
        {"memory": "Thứ 2 lại stress tiếp", "created_at": "2024-01-08"},
        {"memory": "Không thích trà sữa nữa", "created_at": "2024-01-10"},
    ]
    
    result = analyzer.analyze_patterns(test_memories)
    print("=== Pattern Analysis ===")
    print(result)
    
    contradictions = analyzer.detect_contradictions(test_memories)
    print("\n=== Contradictions ===")
    print(contradictions)
