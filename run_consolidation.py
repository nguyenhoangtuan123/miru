"""Script chạy thủ công để kích hoạt nén KEY DECISIONS & INSIGHTS"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

sys.path.insert(0, str(SRC))

from memory_service import MemoryService

# Khởi tạo service
ms = MemoryService()

# Chạy nén cho session 171
session_id = int(sys.argv[1]) if len(sys.argv) > 1 else 171
user_id = sys.argv[2] if len(sys.argv) > 2 else ""
result = ms.consolidate_memory_cycle(session_id, user_id)

if result:
    print("✅ Nén thành công!")
else:
    print("⚠️ Không có gì để nén hoặc đã gặp lỗi.")
