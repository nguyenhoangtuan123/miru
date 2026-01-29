# file: memory_service.py
"""
Mem0 Memory Service cho Miru
Thay thế hệ thống lưu trữ thủ công bằng Mem0 với Graph Memory
"""

import os
import json
import logging
import threading
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv
from settings import settings
import config

load_dotenv()

# === SETUP FILE LOGGING ===
mem0_logger = logging.getLogger("mem0_service")
mem0_logger.setLevel(logging.DEBUG)

# File handler - ghi log vào file
log_file = os.path.join(os.path.dirname(__file__), "mem0.log")
file_handler = logging.FileHandler(log_file, encoding="utf-8")
file_handler.setLevel(logging.DEBUG)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

# Format
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

mem0_logger.addHandler(file_handler)
mem0_logger.addHandler(console_handler)

mem0_logger.info("=== MEM0 SERVICE STARTED ===")
# === END LOGGING SETUP ===

# Lazy import để tránh lỗi khi chưa cài đặt
_memory_instance = None


def get_mem0_config() -> dict:
    """
    Cấu hình Mem0 sử dụng:
    - Vector Store: Supabase (pgvector)
    - LLM: Gemini (theo config)
    - Embedder: Google Gemini (text-embedding-004)
    - Graph Store: Kuzu (local) cho quan hệ entities
    """
    SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")  # postgresql://...
    GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    
    # DEBUG: Log connection string (mask password)
    if SUPABASE_DB_URL:
        # Extract port from connection string for logging
        import re
        port_match = re.search(r':(\d+)/', SUPABASE_DB_URL)
        port = port_match.group(1) if port_match else "unknown"
        mem0_logger.info(f"[CONFIG] SUPABASE_DB_URL port: {port}")
    
    if not all([SUPABASE_DB_URL, GEMINI_API_KEY]):
        raise ValueError(
            "Thiếu biến môi trường. Cần: SUPABASE_DB_URL, GOOGLE_API_KEY"
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
            "provider": "gemini",
            "config": {
                "model": config.MEM0_MODEL_NAME,
                "api_key": GEMINI_API_KEY
            }
        },
        "embedder": {
            "provider": "gemini",
            "config": {
                "model": "models/gemini-embedding-001",
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


def get_memory(force_reinit: bool = False):
    """
    Singleton pattern để lấy instance của Mem0 Memory.
    Chỉ khởi tạo 1 lần khi cần.
    
    Args:
        force_reinit: Nếu True, buộc khởi tạo lại ngay cả khi đã có instance
    """
    global _memory_instance
    
    if force_reinit:
        mem0_logger.info("Force reinit requested, resetting _memory_instance...")
        _memory_instance = None
    
    if _memory_instance is None:
        mem0_logger.info("Initializing Mem0 Memory...")
        from mem0 import Memory
        
        try:
            mem0_config = get_mem0_config()
            mem0_logger.debug(f"Mem0 config: LLM={mem0_config['llm']['config']['model']}, Embedder={mem0_config['embedder']['config']['model']}")
        except Exception as config_err:
            mem0_logger.error(f"Failed to get Mem0 config: {config_err}")
            return None
        
        try:
            _memory_instance = Memory.from_config(mem0_config)
            mem0_logger.info("[OK] Mem0 Memory initialized successfully!")
        except Exception as e:
            error_msg = str(e)
            mem0_logger.error(f"Mem0 initialization error: {error_msg}")
            
            if "index" in error_msg.lower() and "does not exist" in error_msg.lower():
                mem0_logger.warning("Index issue detected, retrying...")
                try:
                    _memory_instance = Memory.from_config(mem0_config)
                    mem0_logger.info("[OK] Mem0 Memory initialized (retry successful)")
                except Exception as e2:
                    mem0_logger.error(f"Mem0 init retry failed: {e2}")
                    _memory_instance = None
            else:
                import traceback
                mem0_logger.error(traceback.format_exc())
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
            mem0_logger.warning("MemoryService running without Mem0 - memories will not be saved")
        else:
            mem0_logger.info("MemoryService initialized successfully")
    
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
        mem0_logger.info(f"[ADD_CONVERSATION] Called for user={user_id}")
        mem0_logger.debug(f"  User msg: {user_message[:100]}...")
        mem0_logger.debug(f"  AI msg: {ai_message[:100]}...")
        
        if self.memory is None:
            mem0_logger.error("self.memory is None! Cannot save.")
            return {"results": [], "warning": "Memory service not available"}
        
        messages = [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": ai_message}
        ]
        
        try:
            mem0_logger.debug("Calling self.memory.add()...")
            result = self.memory.add(
                messages, 
                user_id=user_id,
                metadata=metadata or {}
            )
            
            # Log kết quả
            num_items = len(result.get('results', []))
            mem0_logger.info(f"[SUCCESS] Saved {num_items} facts for user {user_id}")
            mem0_logger.debug(f"Full result: {result}")
            
            return result
        except Exception as e:
            mem0_logger.error(f"Mem0 add failed: {e}")
            import traceback
            mem0_logger.error(traceback.format_exc())
            traceback.print_exc()
            return {"results": [], "error": str(e)}
    
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
        return ""

    def ensure_session_dir(self, session_id: Any) -> str:
        """Đảm bảo thư mục lưu trữ cho session tồn tại"""
        base_dir = os.path.join(os.path.dirname(__file__), "memories")
        session_dir = os.path.join(base_dir, f"session_{session_id}")
        os.makedirs(session_dir, exist_ok=True)
        return session_dir

    def get_session_facts(self, session_id: Any) -> str:
        """Đọc nội dung file facts.txt của session"""
        session_dir = self.ensure_session_dir(session_id)
        facts_path = os.path.join(session_dir, "facts.txt")
        
        # New 4-part structure template
        default_template = """[THE HOOK]
- Chưa xác định nguyên nhân gốc rễ.

[EMOTIONAL ARC]
- [Bắt đầu]: Trạng thái bình thường.

[KEY DECISIONS & INSIGHTS]
- Chưa có quyết định quan trọng.

[UNSPOKEN CONTEXT]
- Chưa có suy luận tâm lý.
"""
        
        if not os.path.exists(facts_path):
            with open(facts_path, "w", encoding="utf-8") as f:
                f.write(default_template)
            return default_template
            
        with open(facts_path, "r", encoding="utf-8") as f:
            content = f.read()
            # If old format detected, backup and migrate (simple append for now)
            if "[THE HOOK]" not in content and "[USER INFO]" in content:
                # Backup old file
                backup_path = os.path.join(session_dir, "facts_legacy_backup.txt")
                with open(backup_path, "w", encoding="utf-8") as bf:
                    bf.write(content)
                print(f"[MIGRATE] Backed up legacy facts to {backup_path}")
                
                # Create new format but keep old content as reference in context
                new_content = default_template + "\n\n[LEGACY NOTES]\n" + content
                with open(facts_path, "w", encoding="utf-8") as f:
                    f.write(new_content)
                return new_content
                
            return content

    def update_session_facts_background(self, session_id: Any, user_input: str, ai_response: str):
        """Cập nhật facts.txt trong luồng phụ (không block user)"""
        thread = threading.Thread(
            target=self._update_facts_sync, 
            args=(session_id, user_input, ai_response)
        )
        thread.daemon = True
        thread.start()

    def _update_facts_sync(self, session_id: Any, user_input: str, ai_response: str):
        """Worker thực hiện gọi LLM và ghi file - đã tối ưu hóa chống lặp"""
        from ai_service import get_summarizer_service
        import asyncio
        import re
        import json
        
        current_facts = self.get_session_facts(session_id)
        ai = get_summarizer_service()
        
        # Đếm số dòng trong EMOTIONAL ARC để quyết định có cần nén không
        arc_lines = len(re.findall(r'- \d{2}:\d{2}:', current_facts))
        
        # Đếm số dòng trong KEY DECISIONS (tìm section này và đếm số dòng bắt đầu bằng -)
        decisions_count = 0
        decisions_match = re.search(r'\[KEY DECISIONS & INSIGHTS\](.*?)(?=\n\n\[UNSPOKEN CONTEXT\])', current_facts, re.DOTALL)
        if decisions_match:
             decisions_text = decisions_match.group(1)
             decisions_count = len([l for l in decisions_text.split('\n') if l.strip().startswith('- ')])

        needs_consolidation = arc_lines > 15 or decisions_count > 30
        
        if needs_consolidation:
            # Chạy nén trí nhớ nếu vượt ngưỡng
            self.consolidate_memory_cycle(session_id, "user_default") # Thay bằng ID user thực tế nếu có

        # Prompt đã tối ưu: chỉ yêu cầu Delta (thông tin mới), không yêu cầu viết lại
        prompt = f"""
BẠN LÀ CHUYÊN GIA TÂM LÝ & THƯ KÝ CỦA PHIÊN CHAT NÀY.
Nhiệm vụ: Trích xuất THÔNG TIN MỚI từ hội thoại gần nhất.

[HỘI THOẠI MỚI NHẤT]
User: {user_input}
AI: {ai_response}

YÊU CẦU XỬ LÝ:
Chỉ trả về JSON với những thông tin MỚI phát hiện:
{{
  "update_hook": null hoặc "Cập nhật nếu phát hiện nguyên nhân gốc rễ mới",
  "new_emotional_log": "Trạng thái cảm xúc mới (VD: 'Lo lắng về deadline')",
  "new_decisions": ["Quyết định/Insight mới nếu có"],
  "update_unspoken": null hoặc "Cập nhật nhu cầu ngầm mới"
}}

Quy tắc:
- Nếu không có gì mới, trả về null cho field đó.
- KHÔNG lặp lại thông tin đã có.
- Chỉ ghi nhận sự thay đổi CẢM XÚC thực sự.
"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            response_text = loop.run_until_complete(ai.generate_response(prompt))
            loop.close()
            
            # JSON extraction
            json_str = response_text.strip()
            if "```json" in json_str:
                json_str = json_str.split("```json")[1].split("```")[0].strip()
            elif "```" in json_str:
                json_str = json_str.split("```")[1].split("```")[0].strip()
                
            try:
                data = json.loads(json_str)
                
                session_dir = self.ensure_session_dir(session_id)
                facts_path = os.path.join(session_dir, "facts.txt")
                
                if os.path.exists(facts_path):
                    with open(facts_path, "r", encoding="utf-8") as f:
                        content = f.read()
                else:
                    content = self.get_session_facts(session_id)

                modified = False

                # 1. Update [THE HOOK] - CHỈ KHI CHƯA CÓ HOẶC CÓ CẬP NHẬT MỚI
                if data.get("update_hook") and data["update_hook"] != "null":
                    # Chỉ cập nhật nếu phần HOOK hiện tại rỗng hoặc chỉ có template
                    hook_match = re.search(r'\[THE HOOK\]\s*\n(- .+)?', content)
                    if hook_match and (not hook_match.group(1) or "Chưa xác định" in (hook_match.group(1) or "")):
                        content = re.sub(
                            r'\[THE HOOK\]\s*\n(- .*)?', 
                            f"[THE HOOK]\n- {data['update_hook']}\n", 
                            content
                        )
                        modified = True
                
                # 2. Update [EMOTIONAL ARC] - APPEND không lặp
                if data.get("new_emotional_log") and data["new_emotional_log"] != "null":
                    from datetime import datetime
                    timestamp = datetime.now().strftime("%H:%M")
                    new_log = f"- {timestamp}: {data['new_emotional_log']}"
                    
                    # Kiểm tra xem log này đã tồn tại chưa (tránh lặp)
                    if new_log not in content and data['new_emotional_log'] not in content:
                        if "[EMOTIONAL ARC]" in content:
                            # Tìm vị trí cuối của section EMOTIONAL ARC
                            arc_end = content.find("\n\n[KEY DECISIONS")
                            if arc_end == -1:
                                arc_end = content.find("\n\n[UNSPOKEN")
                            if arc_end != -1:
                                content = content[:arc_end] + f"\n{new_log}" + content[arc_end:]
                            else:
                                # Append ở cuối EMOTIONAL ARC
                                content = content.replace("[EMOTIONAL ARC]", f"[EMOTIONAL ARC]\n{new_log}", 1)
                            modified = True
                
                # 3. Update [KEY DECISIONS & INSIGHTS] - APPEND không lặp
                if data.get("new_decisions") and len(data["new_decisions"]) > 0:
                    new_points = []
                    for item in data["new_decisions"]:
                        if item and item not in content:
                            new_points.append(f"- {item}")
                    
                    if new_points:
                        decisions_end = content.find("\n\n[UNSPOKEN CONTEXT]")
                        if decisions_end != -1:
                            insert_text = "\n" + "\n".join(new_points)
                            content = content[:decisions_end] + insert_text + content[decisions_end:]
                            modified = True
                
                # 4. Update [UNSPOKEN CONTEXT] - CHỈ KHI CÓ CẬP NHẬT MỚI
                if data.get("update_unspoken") and data["update_unspoken"] != "null":
                    if data['update_unspoken'] not in content:
                        unspoken_match = re.search(r'\[UNSPOKEN CONTEXT\]\s*\n', content)
                        if unspoken_match:
                            insert_pos = unspoken_match.end()
                            new_unspoken = f"- {data['update_unspoken']}\n"
                            content = content[:insert_pos] + new_unspoken + content[insert_pos:]
                            modified = True
                
                if modified:
                    with open(facts_path, "w", encoding="utf-8") as f:
                        f.write(content)
                    print(f"[OK] Facts updated for session {session_id} (Dedup-safe)")
                else:
                    print(f"[SKIP] No new facts to add for session {session_id}")
                    
            except json.JSONDecodeError:
                print(f"[WARN] Failed to parse JSON from facts summarizer: {json_str}")
                
        except Exception as e:
            print(f"[ERROR] Failed to update facts.txt: {e}")

    def consolidate_memory_cycle(self, session_id: Any, user_id: str):
        """
        Cơ chế nén trí nhớ (Memory Consolidation) - Giống như quá trình ngủ của não.
        Khi EMOTIONAL ARC hoặc KEY DECISIONS quá dài (>15 dòng), nén lại thành insights cốt lõi.
        """
        import re
        import asyncio
        from ai_service import get_summarizer_service
        
        session_dir = self.ensure_session_dir(session_id)
        facts_path = os.path.join(session_dir, "facts.txt")
        
        if not os.path.exists(facts_path):
            return False
            
        with open(facts_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        modified = False
        ai = get_summarizer_service()
        
        # === 1. NÉN EMOTIONAL ARC ===
        arc_match = re.search(r'\[EMOTIONAL ARC\](.*?)(?=\n\n\[KEY DECISIONS)', content, re.DOTALL)
        if arc_match:
            arc_content = arc_match.group(1)
            arc_lines = [l.strip() for l in arc_content.split('\n') if l.strip().startswith('- ') and not l.strip().startswith('- [Insight')]
            
            if len(arc_lines) > 15:
                print(f"[CONSOLIDATE] Compressing EMOTIONAL ARC ({len(arc_lines)} lines -> 5 insights)")
                
                arc_prompt = f"""
BẠN LÀ CHUYÊN GIA TÂM LÝ. Nén toàn bộ nhật ký cảm xúc thành 5 dòng "Insight cốt lõi".

[NHẬT KÝ CẢM XÚC]
{arc_content}

Trả về 5 dòng theo format:
- [Insight 1: Trạng thái cảm xúc chi phối]
- [Insight 2: Sự thay đổi lớn nhất]
- [Insight 3: Nguyên nhân gốc rễ]
- [Insight 4: Nhu cầu ngầm chưa được đáp ứng]
- [Insight 5: Hướng đi tiếp theo]
CHỈ TRẢ VỀ 5 DÒNG, KHÔNG GIẢI THÍCH.
"""
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    compressed_arc = loop.run_until_complete(ai.generate_response(arc_prompt))
                    loop.close()
                    
                    new_arc = f"[EMOTIONAL ARC]\n[CONSOLIDATED - {len(arc_lines)} events compressed]\n{compressed_arc.strip()}\n"
                    content = re.sub(r'\[EMOTIONAL ARC\](.*?)(?=\n\n\[KEY DECISIONS)', new_arc + '\n', content, flags=re.DOTALL)
                    modified = True
                except Exception as e:
                    print(f"[ERROR] Arc consolidation failed: {e}")

        # === 2. NÉN KEY DECISIONS & INSIGHTS (Batch Compression) ===
        decisions_match = re.search(r'\[KEY DECISIONS & INSIGHTS\](.*?)(?=\n\n\[UNSPOKEN CONTEXT\])', content, re.DOTALL)
        if decisions_match:
            decisions_content = decisions_match.group(1).strip()
            
            # Lọc ra các dòng actual content (bắt đầu bằng - )
            all_lines = [l.strip() for l in decisions_content.split('\n') if l.strip().startswith('- ')]
            
            # TRIGGER START: > 30 dòng
            if len(all_lines) > 30:
                print(f"[CONSOLIDATE] Compressing KEY DECISIONS (Total {len(all_lines)} items) using Batching (3->1)...")
                
                decisions_prompt = f"""
BẠN LÀ CHUYÊN GIA TÂM LÝ VÀ BIÊN TẬP VIÊN LOGIC.
Nhiệm vụ: Nén danh sách các quyết định/insight dưới đây theo phương pháp "Gộp 3 thành 1" (Batch Consolidation).

[DANH SÁCH GỐC ({len(all_lines)} dòng)]
{decisions_content}

QUY TẮC NÉN BẮT BUỘC:
1. Đi lần lượt từ trên xuống dưới, gộp mỗi 3 dòng liên tiếp thành 1 dòng duy nhất.
2. Dòng gộp phải tóm tắt súc tích nhưng GIỮ NGUYÊN nội dung quan trọng của cả 3 dòng gốc.
3. KHÔNG bỏ sót thông tin, chỉ viết lại cho gọn gàng hơn.
4. QUAN TRỌNG: Trong quá trình gộp nội dung 3 dòng, nếu bạn phát hiện một sự thay đổi tâm lý hoặc một MÔ THỨC HÀNH VI MỚI nảy sinh từ sự kết hợp này, hãy gọi tên nó ngay.
   - Format gọi tên: Thêm tag `[NEW PATTERN: Tên mô thức]` vào cuối dòng đó.
   - Ví dụ: "...User do dự nhưng cuối cùng vẫn làm. [NEW PATTERN: Overcoming Fear]"

OUTPUT FORMAT:
- Trả về danh sách các dòng kết quả (bắt đầu bằng "- ").
- Không giải thích gì thêm.
"""
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    compressed_decisions = loop.run_until_complete(ai.generate_response(decisions_prompt))
                    loop.close()
                    
                    # Timestamp
                    from datetime import datetime
                    ts = datetime.now().strftime("%d/%m")
                    
                    # Header mới, không dùng [CONSOLIDATED] để có thể append tiếp tự nhiên
                    new_decisions = f"[KEY DECISIONS & INSIGHTS]\n[Batched Summary - Updated {ts}]\n{compressed_decisions.strip()}\n"
                    
                    # Replace content
                    content = re.sub(r'\[KEY DECISIONS & INSIGHTS\](.*?)(?=\n\n\[UNSPOKEN CONTEXT\])', new_decisions + '\n', content, flags=re.DOTALL)
                    modified = True
                    
                    print(f"[CONSOLIDATE] Compression successful. New length approx {len(compressed_decisions.splitlines())} lines.")
                    
                except Exception as e:
                    print(f"[ERROR] Decisions batch consolidation failed: {e}")


        if modified:
            # Lưu bản backup
            backup_path = os.path.join(session_dir, "facts_backup.txt")
            with open(backup_path, "a", encoding="utf-8") as f:
                f.write(f"\n\n=== BACKUP {session_id} ===\n{content}\n")
            
            with open(facts_path, "w", encoding="utf-8") as f:
                f.write(content)
                
            print(f"[OK] Memory consolidation complete for session {session_id}")
            
            # Đẩy vào Mem0
            if self.memory:
                self.memory.add(
                    [{"role": "system", "content": f"Session {session_id} consolidated."}],
                    user_id=user_id,
                    metadata={"type": "consolidated_insights", "session_id": str(session_id)}
                )
            return True
        
        print(f"[SKIP] No consolidation needed for session {session_id}")
        return False


    def sync_session_facts_to_mem0(self, session_id: Any, user_id: str) -> bool:
        """
        Đồng bộ nội dung quan trọng từ facts.txt vào Mem0 (Long-term Memory).
        Chỉ lưu 4 phần chính: Hook, Emotional Arc, Decisions, Unspoken Context.
        
        Returns:
            True nếu thành công
        """
        if self.memory is None:
            return False
            
        print(f"[SYNC] Starting sync for session {session_id} to Mem0...")
        try:
            facts_content = self.get_session_facts(session_id)
            
            # Simple parsing of sections
            sections = {
                "THE HOOK": "",
                "EMOTIONAL ARC": "",
                "KEY DECISIONS & INSIGHTS": "",
                "UNSPOKEN CONTEXT": ""
            }
            
            current_section = None
            for line in facts_content.split('\n'):
                line = line.strip()
                if line.startswith('[') and line.endswith(']'):
                    section_name = line[1:-1]
                    if section_name in sections:
                        current_section = section_name
                    else:
                        current_section = None # Skip other sections like [LEGACY NOTES]
                elif current_section and line:
                    sections[current_section] += line + "\n"
            
            # Construct memory text
            # Construct a narrative summary for better Mem0 extraction
            hook_content = sections['THE HOOK'].strip() or "Chưa xác định"
            emotional_content = sections['EMOTIONAL ARC'].strip() or "Chưa có dữ liệu"
            decisions_content = sections['KEY DECISIONS & INSIGHTS'].strip() or "Chưa có quyết định"
            unspoken_content = sections['UNSPOKEN CONTEXT'].strip() or "Chưa có suy luận"

            memory_text = f"""
Summary of Session {session_id} with User {user_id}:

The user's core motivation and initial state (The Hook) was:
{hook_content}

The user's emotional journey (Emotional Arc) during the session was:
{emotional_content}

Key decisions and insights from this session were:
{decisions_content}

Unspoken context and psychological observations included:
{unspoken_content}
"""
            # Save to Mem0 as a structured memory
            # We add it as a single memory item representing the summary of the session
            result = self.search_memories(user_id, f"Session Summary {session_id}", limit=1)
            
            # Check if we already have a summary for this session
            existing_id = None
            if result:
                for mem in result:
                    # Check metadata match safely
                    metadata = mem.get('metadata') or {}
                    if metadata.get('session_id') == session_id and metadata.get('type') == 'session_summary':
                        existing_id = mem['id']
                        break
            
            if existing_id:
                self.update_memory(existing_id, memory_text)
                print(f"[SYNC] Updated existing session summary in Mem0 (ID: {existing_id})")
            else:
                self.memory.add(
                    [{"role": "user", "content": memory_text}], 
                    user_id=user_id,
                    metadata={"session_id": session_id, "type": "session_summary", "source": "facts_sync"}
                )
                print(f"[SYNC] Created new session summary in Mem0")
                
            return True
            
        except Exception as e:
            print(f"[ERROR] Sync failed: {e}")
            import traceback
            traceback.print_exc()
            return False

# Singleton instance
_service_instance = None


def get_memory_service() -> MemoryService:
    """
    Lấy singleton instance của MemoryService.
    Nếu memory bị None, sẽ thử khởi tạo lại.
    """
    global _service_instance
    
    # Nếu chưa có instance, tạo mới
    if _service_instance is None:
        mem0_logger.info("Creating new MemoryService instance...")
        _service_instance = MemoryService()
    
    # Nếu instance có memory = None, thử khởi tạo lại với force_reinit
    elif _service_instance.memory is None:
        mem0_logger.warning("Existing MemoryService has memory=None, retrying with force_reinit...")
        _service_instance.memory = get_memory(force_reinit=True)
        if _service_instance.memory is not None:
            mem0_logger.info("Retry successful! Mem0 is now available.")
        else:
            mem0_logger.error("Retry failed. Mem0 still unavailable.")
    
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
