# file: knowledge_graph_service.py
"""
Knowledge Graph Service
Trích xuất entities và relationships từ memories để tạo Knowledge Graph.
"""

import os
import re
from typing import List, Dict, Any
from dotenv import load_dotenv
from groq import Groq

load_dotenv()


class KnowledgeGraphService:
    """
    Dịch vụ tạo Knowledge Graph từ memories.
    Trích xuất entities (người, địa điểm, cảm xúc, sở thích) và relationships.
    """
    
    def __init__(self):
        self.groq = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = "llama-3.3-70b-versatile"
    
    def extract_knowledge_graph(self, memories: List[Dict], user_name: str = "Bạn") -> Dict[str, Any]:
        """
        Trích xuất entities và relationships từ danh sách memories.
        
        Returns:
            {
                "central_node": { "id": "user", "label": "Dương", "type": "person" },
                "nodes": [
                    { "id": "...", "label": "...", "type": "attribute|person|emotion|preference", "sentiment": "positive|negative|neutral" }
                ],
                "edges": [
                    { "from": "user", "to": "...", "label": "..." }
                ]
            }
        """
        if not memories:
            return {"central_node": None, "nodes": [], "edges": []}
        
        # Combine all memories into text
        memories_text = "\n".join([
            f"- {m.get('memory', m.get('text', ''))}" 
            for m in memories 
            if m.get('memory') or m.get('text')
        ])
        
        # Use LLM to extract structured data
        prompt = f"""Phân tích các ký ức sau và trích xuất thông tin dưới dạng Knowledge Graph.

KÝ ỨC:
{memories_text}

Trả về JSON với format:
{{
  "user_name": "Tên người dùng nếu có, hoặc 'Bạn'",
  "entities": [
    {{"text": "nội dung", "type": "attribute|preference|emotion|person|goal", "sentiment": "positive|negative|neutral", "relationship": "là|thích|ghét|có|muốn|cảm thấy"}}
  ]
}}

TYPES:
- attribute: thuộc tính cá nhân (tuổi, nghề, ngôn ngữ)
- preference: sở thích (thích/ghét cái gì)
- emotion: cảm xúc (vui, buồn, lo lắng)
- person: người liên quan (bạn bè, gia đình)
- goal: mục tiêu, mong muốn

Chỉ trả về JSON, không giải thích."""

        try:
            response = self.groq.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1000
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Parse JSON from response
            import json
            # Find JSON in response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                data = json.loads(json_match.group())
            else:
                return self._fallback_extraction(memories, user_name)
            
            # Build graph structure
            user_label = data.get("user_name", user_name)
            nodes = []
            edges = []
            
            for i, entity in enumerate(data.get("entities", [])):
                node_id = f"node_{i}"
                nodes.append({
                    "id": node_id,
                    "label": entity.get("text", "")[:30],
                    "full_text": entity.get("text", ""),
                    "type": entity.get("type", "attribute"),
                    "sentiment": entity.get("sentiment", "neutral")
                })
                edges.append({
                    "from": "user",
                    "to": node_id,
                    "label": entity.get("relationship", "có")
                })
            
            return {
                "central_node": {
                    "id": "user",
                    "label": user_label,
                    "type": "person"
                },
                "nodes": nodes,
                "edges": edges
            }
            
        except Exception as e:
            print(f"[KnowledgeGraph] Error: {e}")
            return self._fallback_extraction(memories, user_name)
    
    def _fallback_extraction(self, memories: List[Dict], user_name: str) -> Dict[str, Any]:
        """Fallback khi AI không trích xuất được - dùng simple parsing."""
        nodes = []
        edges = []
        
        for i, m in enumerate(memories[:15]):  # Limit to 15
            text = m.get('memory', m.get('text', ''))
            if not text:
                continue
            
            text_lower = text.lower()
            
            # Detect type based on keywords
            node_type = "attribute"  # default
            
            # Emotion detection
            emotion_words = ["cảm thấy", "buồn", "vui", "lo lắng", "stress", "hạnh phúc", 
                           "tức giận", "sợ", "lo âu", "mệt", "chán", "hào hứng", "phấn khích"]
            if any(w in text_lower for w in emotion_words):
                node_type = "emotion"
            
            # Preference detection  
            elif any(w in text_lower for w in ["thích", "yêu thích", "ghét", "không thích", 
                                               "ưa", "mê", "đam mê", "sở thích"]):
                node_type = "preference"
            
            # Person detection
            elif any(w in text_lower for w in ["bạn gái", "bạn trai", "người yêu", "vợ", "chồng",
                                               "bố", "mẹ", "anh", "chị", "em", "ông", "bà",
                                               "bạn bè", "đồng nghiệp", "sếp", "crush"]):
                node_type = "person"
            
            # Goal detection
            elif any(w in text_lower for w in ["muốn", "mục tiêu", "kế hoạch", "dự định", 
                                               "ước mơ", "tương lai", "sẽ", "cần", "phải"]):
                node_type = "goal"
            
            # Simple sentiment detection
            sentiment = "neutral"
            if any(w in text_lower for w in ["thích", "yêu", "vui", "tốt", "hay", "hạnh phúc"]):
                sentiment = "positive"
            elif any(w in text_lower for w in ["ghét", "buồn", "chán", "khó", "không thích", "lo", "sợ"]):
                sentiment = "negative"
            
            # Detect relationship
            relationship = "có"
            if "thích" in text_lower or "yêu" in text_lower:
                relationship = "thích"
            elif "ghét" in text_lower or "không thích" in text_lower:
                relationship = "không thích"
            elif "cảm thấy" in text_lower:
                relationship = "cảm thấy"
            elif "muốn" in text_lower:
                relationship = "muốn"
            elif "là" in text_lower:
                relationship = "là"
            
            nodes.append({
                "id": f"mem_{i}",
                "label": text[:25] + "..." if len(text) > 25 else text,
                "full_text": text,
                "type": node_type,
                "sentiment": sentiment
            })
            edges.append({
                "from": "user",
                "to": f"mem_{i}",
                "label": relationship
            })
        
        return {
            "central_node": {
                "id": "user",
                "label": user_name,
                "type": "person"
            },
            "nodes": nodes,
            "edges": edges
        }


# Singleton
_service = None

def get_knowledge_graph_service() -> KnowledgeGraphService:
    global _service
    if _service is None:
        _service = KnowledgeGraphService()
    return _service


# Test
if __name__ == "__main__":
    service = get_knowledge_graph_service()
    
    test_memories = [
        {"memory": "Tên là Dương"},
        {"memory": "Độ tuổi là 21"},
        {"memory": "Không thích gà chiên và gà luộc"},
        {"memory": "Thích uống trà sữa"},
        {"memory": "Đang cảm thấy buồn về công việc"},
        {"memory": "Có một người bạn tên Lan"}
    ]
    
    result = service.extract_knowledge_graph(test_memories)
    
    print("Central:", result["central_node"])
    print("\nNodes:")
    for n in result["nodes"]:
        print(f"  {n['label']} ({n['type']}, {n['sentiment']})")
    print("\nEdges:")
    for e in result["edges"]:
        print(f"  user --{e['label']}--> {e['to']}")
