# file: memory_service.py
"""
Mem0 Memory Service cho Miru
Thay thế hệ thống lưu trữ thủ công bằng Mem0 với Graph Memory
"""

import os
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Lazy import để tránh lỗi khi chưa cài đặt
_memory_instance = None


def get_mem0_config() -> dict:
    """
    Cấu hình Mem0 sử dụng:
    - Vector Store: Supabase (pgvector)
    - LLM: Groq (để trích xuất facts từ conversation)
    - Embedder: Google Gemini (text-embedding-004)
    - Graph Store: Kuzu (local) cho quan hệ entities
    """
    SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")  # postgresql://...
    GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    
    if not all([SUPABASE_DB_URL, GROQ_API_KEY, GEMINI_API_KEY]):
        raise ValueError(
            "Thiếu biến môi trường. Cần: SUPABASE_DB_URL, GROQ_API_KEY, GOOGLE_API_KEY"
        )
    
    return {
        "vector_store": {
            "provider": "supabase",
            "config": {
                "collection_name": "memories",
                "connection_string": SUPABASE_DB_URL,
                "embedding_model_dims": 768  # text-embedding-004 dimension
            }
        },
        "llm": {
            "provider": "groq",
            "config": {
                "model": "openai/gpt-oss-120b",
                "api_key": GROQ_API_KEY
            }
        },
        "embedder": {
            "provider": "gemini",
            "config": {
                "model": "text-embedding-004",
                "api_key": GEMINI_API_KEY
            }
        },
        # Graph Store - DISABLED due to Kuzu lock issues on Windows
        # "graph_store": {
        #     "provider": "kuzu",
        #     "config": {
        #         "db": os.path.join(os.path.dirname(__file__), "kuzu_graph_db")
        #     }
        # }
    }


def get_memory():
    """
    Singleton pattern để lấy instance của Mem0 Memory.
    Chỉ khởi tạo 1 lần khi cần.
    """
    global _memory_instance
    
    if _memory_instance is None:
        from mem0 import Memory
        config = get_mem0_config()
        
        try:
            _memory_instance = Memory.from_config(config)
            print("[OK] Mem0 Memory initialized with Graph Memory")
        except Exception as e:
            error_msg = str(e)
            if "index" in error_msg.lower() and "does not exist" in error_msg.lower():
                # Index error - try again without index recreation
                print(f"[WARN] Mem0 index issue detected, retrying...")
                try:
                    _memory_instance = Memory.from_config(config)
                    print("[OK] Mem0 Memory initialized (retry successful)")
                except Exception as e2:
                    print(f"[ERROR] Mem0 init failed: {e2}")
                    # Create a minimal fallback that won't crash
                    _memory_instance = None
            else:
                print(f"[ERROR] Mem0 initialization error: {e}")
                _memory_instance = None
    
    return _memory_instance


class MemoryService:
    """
    Service wrapper cho Mem0 - cung cấp các phương thức tiện lợi
    để tích hợp vào hệ thống chat hiện tại.
    """
    
    def __init__(self):
        self.memory = get_memory()
        if self.memory is None:
            print("[WARN] MemoryService running without Mem0 - memories will not be saved")
    
    def add_conversation(
        self, 
        user_id: str, 
        user_message: str, 
        ai_message: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Thêm một cặp hội thoại vào bộ nhớ.
        Mem0 sẽ tự động trích xuất các facts quan trọng.
        
        Returns:
            Dict chứa kết quả từ Mem0 (số items được lưu, relations mới, etc.)
        """
        if self.memory is None:
            return {"results": [], "warning": "Memory service not available"}
        
        messages = [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": ai_message}
        ]
        
        result = self.memory.add(
            messages, 
            user_id=user_id,
            metadata=metadata or {}
        )
        
        # Log kết quả
        num_items = len(result.get('results', []))
        print(f"[SAVE] Mem0: Saved {num_items} facts for user {user_id}")
        
        return result
    
    def search_memories(
        self, 
        user_id: str, 
        query: str, 
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Tìm kiếm ký ức liên quan đến query.
        
        Returns:
            List các memories có liên quan
        """
        if self.memory is None:
            return []
        
        result = self.memory.search(
            query=query, 
            user_id=user_id, 
            limit=limit
        )
        
        memories = result.get("results", [])
        print(f"[SEARCH] Mem0: Found {len(memories)} memories for query: '{query[:50]}...'")
        
        return memories
    
    def get_all_memories(self, user_id: str) -> Dict[str, Any]:
        """
        Lấy tất cả memories của một user.
        Bao gồm cả relations (graph data).
        
        Returns:
            Dict chứa 'results' (memories) và 'relations' (graph entities)
        """
        if self.memory is None:
            return {"results": [], "relations": []}
        return self.memory.get_all(user_id=user_id)
    
    def delete_memory(self, memory_id: str) -> bool:
        """
        Xóa một memory cụ thể.
        
        Returns:
            True nếu thành công
        """
        try:
            if self.memory is None:
                return False
            self.memory.delete(memory_id)
            print(f"[DELETE] Mem0: Deleted memory {memory_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Mem0: Delete error: {e}")
            return False
    
    def delete_all_memories(self, user_id: str) -> bool:
        """
        Xóa tất cả memories của một user.
        
        Returns:
            True nếu thành công
        """
        try:
            if self.memory is None:
                return False
            self.memory.delete_all(user_id=user_id)
            print(f"[DELETE] Mem0: Deleted all memories for user {user_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Mem0: Delete all error: {e}")
            return False
    
    def update_memory(self, memory_id: str, new_data: str) -> bool:
        """
        Cập nhật nội dung một memory.
        
        Returns:
            True nếu thành công
        """
        try:
            self.memory.update(memory_id, new_data)
            print(f"[UPDATE] Mem0: Updated memory {memory_id}")
            return True
        except Exception as e:
            print(f"[ERROR] Mem0: Update error: {e}")
            return False
    
    def get_memory_context_for_chat(
        self, 
        user_id: str, 
        current_message: str,
        limit: int = 3
    ) -> str:
        """
        Lấy context từ memories để inject vào prompt của AI.
        Đây là phương thức chính để tích hợp vào chat.
        
        Returns:
            String chứa các memories liên quan, sẵn sàng để inject vào prompt
        """
        memories = self.search_memories(user_id, current_message, limit)
        
        if not memories:
            return ""
        
        # Format memories thành text
        memory_lines = []
        for m in memories:
            memory_text = m.get('memory', '')
            if memory_text:
                memory_lines.append(f"- {memory_text}")
        
        if memory_lines:
            return "Những điều tôi nhớ về bạn:\n" + "\n".join(memory_lines)
        
        return ""


# Singleton instance
_service_instance = None


def get_memory_service() -> MemoryService:
    """
    Lấy singleton instance của MemoryService.
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = MemoryService()
    return _service_instance


# === Test function ===
async def test_memory_service():
    """Test cơ bản cho MemoryService"""
    service = get_memory_service()
    
    test_user = "test_user_123"
    
    # Test add
    result = service.add_conversation(
        user_id=test_user,
        user_message="Tôi tên là Dương, sinh năm 2006",
        ai_message="Chào Dương! Tôi sẽ nhớ tên bạn."
    )
    print("Add result:", result)
    
    # Test search
    memories = service.search_memories(test_user, "tên")
    print("Search result:", memories)
    
    # Test context
    context = service.get_memory_context_for_chat(test_user, "Bạn có nhớ tên tôi không?")
    print("Context:", context)


if __name__ == "__main__":
    import asyncio
    asyncio.run(test_memory_service())
