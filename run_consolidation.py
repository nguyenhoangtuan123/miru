"""Script chạy thủ công để kích hoạt nén KEY DECISIONS & INSIGHTS"""
import sys
sys.path.insert(0, '.')

from memory_service import MemoryService

# Khởi tạo service
ms = MemoryService()

# Chạy nén cho session 171
result = ms.consolidate_memory_cycle(171, "user_default")

if result:
    print("✅ Nén thành công!")
else:
    print("⚠️ Không có gì để nén hoặc đã gặp lỗi.")
