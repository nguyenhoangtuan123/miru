# file: facts_parser.py
"""
Facts Parser Service
Parses facts from database (or local files as fallback) into structured JSON for analytics dashboard
"""

import os
import re
from typing import Dict, List, Optional
from datetime import datetime


class FactsParser:
    """Parse facts from database into structured data"""
    
    def __init__(self, memories_dir: str = "memories"):
        self.memories_dir = memories_dir
        self._db = None
    
    def _get_db(self):
        """Lazy load database connection"""
        if self._db is None:
            try:
                from database import DatabaseManager
                self._db = DatabaseManager()
            except Exception as e:
                print(f"[WARN] FactsParser: Failed to connect to DB: {e}")
        return self._db
    
    def _get_facts_from_db(self, session_id: str) -> Optional[str]:
        """Read facts from database"""
        try:
            db = self._get_db()
            if not db:
                return None
            
            response = db.supabase.table('analyzed_sessions')\
                .select('facts_content')\
                .eq('session_id', int(session_id))\
                .execute()
            
            if response.data and response.data[0].get('facts_content'):
                return response.data[0]['facts_content']
            return None
        except Exception as e:
            print(f"[WARN] FactsParser: Failed to get facts from DB: {e}")
            return None
    
    def parse_session(self, session_id: str) -> Dict:
        """Parse a single session's facts - reads from DB first, then local file as fallback"""
        content = None
        
        # 1. Try database first
        content = self._get_facts_from_db(session_id)
        
        # 2. Fallback to local file
        if not content:
            facts_path = os.path.join(self.memories_dir, f"session_{session_id}", "facts.txt")
            if os.path.exists(facts_path):
                with open(facts_path, "r", encoding="utf-8") as f:
                    content = f.read()
        
        if not content:
            return {"error": f"Session {session_id} not found"}
        
        return self._parse_content(content, session_id)
    
    def _parse_content(self, content: str, session_id: str) -> Dict:
        """Parse facts.txt content into structured data"""
        result = {
            "session_id": session_id,
            "hook": "",
            "emotional_arc": [],
            "consolidated_insights": [],
            "key_decisions": [],
            "unspoken_context": [],
            "raw_emotions": []
        }
        
        # Split by sections
        sections = self._split_sections(content)
        
        # Parse each section
        for section_name, section_content in sections.items():
            if section_name == "THE HOOK":
                result["hook"] = self._clean_text(section_content)
            elif section_name == "EMOTIONAL ARC":
                arc_data = self._parse_emotional_arc(section_content)
                result["emotional_arc"] = arc_data["timeline"]
                result["consolidated_insights"] = arc_data["insights"]
            elif section_name == "KEY DECISIONS & INSIGHTS":
                result["key_decisions"] = self._parse_list(section_content)
            elif section_name == "UNSPOKEN CONTEXT":
                result["unspoken_context"] = self._parse_list(section_content)
        
        # Calculate emotion summary
        result["emotion_summary"] = self._calculate_emotion_summary(result["emotional_arc"])
        
        return result
    
    def _split_sections(self, content: str) -> Dict[str, str]:
        """Split content into sections by [SECTION_NAME] headers"""
        sections = {}
        current_section = None
        current_content = []
        
        for line in content.split("\n"):
            # Check for section header
            match = re.match(r"\[([A-Z\s&]+)\]", line.strip())
            if match:
                # Save previous section
                if current_section:
                    sections[current_section] = "\n".join(current_content)
                current_section = match.group(1).strip()
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_section:
            sections[current_section] = "\n".join(current_content)
        
        return sections
    
    def _parse_emotional_arc(self, content: str) -> Dict:
        """Parse EMOTIONAL ARC section into timeline and insights"""
        timeline = []
        insights = []
        
        for line in content.split("\n"):
            line = line.strip()
            if not line or line.startswith("[CONSOLIDATED"):
                continue
            
            # Check for timestamp pattern (HH:MM:)
            time_match = re.match(r"-\s*(\d{2}:\d{2}):\s*(.+)", line)
            if time_match:
                time_str = time_match.group(1)
                note = time_match.group(2).strip()
                
                # Detect emotion from content
                emotion = self._detect_emotion(note)
                
                timeline.append({
                    "time": time_str,
                    "emotion": emotion["type"],
                    "score": emotion["score"],
                    "note": note
                })
            
            # Check for insight pattern
            insight_match = re.match(r"-\s*\[Insight\s*(\d+)[:\s]*([^\]]*)\]\s*(.+)", line)
            if insight_match:
                insights.append({
                    "number": int(insight_match.group(1)),
                    "title": insight_match.group(2).strip(),
                    "content": insight_match.group(3).strip()
                })
        
        return {"timeline": timeline, "insights": insights}
    
    def _detect_emotion(self, text: str) -> Dict:
        """Detect emotion type and score from text"""
        text_lower = text.lower()
        
        # Emotion keywords mapping
        emotion_map = {
            "happy": (["vui", "vui vẻ", "hạnh phúc", "phấn khích", "excited", "happy", "ấm áp"], 0.8),
            "anxious": (["lo lắng", "lo âu", "stress", "áp lực", "anxious", "worried"], 0.3),
            "confused": (["bối rối", "lúng túng", "confused", "trăn trở", "ngại ngùng"], 0.5),
            "sad": (["buồn", "sad", "chán", "thất vọng"], 0.2),
            "neutral": (["bình thường", "neutral", "đồng điệu"], 0.5),
            "hopeful": (["hy vọng", "hopeful", "trân trọng", "sẵn sàng"], 0.7),
        }
        
        for emotion, (keywords, score) in emotion_map.items():
            for keyword in keywords:
                if keyword in text_lower:
                    return {"type": emotion, "score": score}
        
        return {"type": "neutral", "score": 0.5}
    
    def _parse_list(self, content: str) -> List[str]:
        """Parse bullet point list"""
        items = []
        for line in content.split("\n"):
            line = line.strip()
            if line.startswith("- "):
                items.append(line[2:].strip())
        return items
    
    def _clean_text(self, text: str) -> str:
        """Clean and normalize text"""
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        return " ".join(lines).replace("- ", "").strip()
    
    def _calculate_emotion_summary(self, timeline: List[Dict]) -> Dict:
        """Calculate emotion statistics from timeline"""
        if not timeline:
            return {"average_score": 0.5, "dominant_emotion": "neutral", "trend": "stable"}
        
        scores = [e["score"] for e in timeline]
        emotions = [e["emotion"] for e in timeline]
        
        avg_score = sum(scores) / len(scores)
        
        # Find dominant emotion
        emotion_counts = {}
        for e in emotions:
            emotion_counts[e] = emotion_counts.get(e, 0) + 1
        dominant = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"
        
        # Calculate trend (comparing first half vs second half)
        if len(scores) >= 2:
            mid = len(scores) // 2
            first_half = sum(scores[:mid]) / mid if mid > 0 else 0.5
            second_half = sum(scores[mid:]) / (len(scores) - mid)
            
            if second_half > first_half + 0.1:
                trend = "improving"
            elif second_half < first_half - 0.1:
                trend = "declining"
            else:
                trend = "stable"
        else:
            trend = "stable"
        
        return {
            "average_score": round(avg_score, 2),
            "dominant_emotion": dominant,
            "trend": trend,
            "data_points": len(timeline)
        }
    
    def list_sessions(self) -> List[str]:
        """List all available session IDs - combines DB and local files"""
        sessions = set()
        
        # 1. Get sessions from database
        try:
            db = self._get_db()
            if db:
                response = db.supabase.table('analyzed_sessions')\
                    .select('session_id')\
                    .not_.is_('facts_content', 'null')\
                    .execute()
                
                if response.data:
                    for row in response.data:
                        sessions.add(str(row['session_id']))
        except Exception as e:
            print(f"[WARN] FactsParser: Failed to list sessions from DB: {e}")
        
        # 2. Also check local files (for backward compatibility)
        if os.path.exists(self.memories_dir):
            for folder in os.listdir(self.memories_dir):
                if folder.startswith("session_"):
                    session_id = folder.replace("session_", "")
                    facts_path = os.path.join(self.memories_dir, folder, "facts.txt")
                    if os.path.exists(facts_path):
                        sessions.add(session_id)
        
        return sorted(list(sessions), key=lambda x: int(x) if x.isdigit() else 0)


# Singleton instance
_parser = None

def get_facts_parser() -> FactsParser:
    global _parser
    if _parser is None:
        _parser = FactsParser()
    return _parser
