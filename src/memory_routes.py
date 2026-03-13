# file: memory_routes.py
"""
API Routes cho Memory Management UI
Cho phép user xem, sửa, xóa ký ức của mình.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from auth_middleware import require_auth_for_user
from memory_service import get_memory_service


router = APIRouter(prefix="/api/memories", tags=["Memories"])


# === Pydantic Models ===

class UpdateMemory(BaseModel):
    new_content: str


def _normalize_memory_item(memory: dict) -> dict:
    normalized = dict(memory or {})
    metadata = normalized.get("metadata")
    normalized["metadata"] = metadata if isinstance(metadata, dict) else {}
    return normalized


# === ROUTES ===

@router.get("/{user_id}")
async def get_all_memories(user_id: str, request: Request):
    """Lấy tất cả memories của user"""
    try:
        await require_auth_for_user(request, user_id)
        service = get_memory_service()
        result = service.get_all_memories(user_id)
        memories = [
            _normalize_memory_item(memory)
            for memory in result.get("results", [])
        ]
        return {
            "success": True,
            "memories": memories,
            "relations": result.get("relations", [])
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error getting memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/search")
async def search_memories(user_id: str, request: Request, q: str, limit: int = 5):
    """Tìm kiếm memories"""
    try:
        await require_auth_for_user(request, user_id)
        service = get_memory_service()
        memories = [
            _normalize_memory_item(memory)
            for memory in service.search_memories(user_id, q, limit)
        ]
        return {"success": True, "memories": memories}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error searching: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/patterns")
async def get_memory_patterns(user_id: str, request: Request):
    """Phân tích patterns từ memories"""
    try:
        await require_auth_for_user(request, user_id)
        from pattern_analyzer import get_pattern_analyzer
        
        memory_service = get_memory_service()
        analyzer = get_pattern_analyzer()
        
        # Get all memories
        result = memory_service.get_all_memories(user_id)
        memories = result.get("results", [])
        
        # Analyze patterns
        patterns = analyzer.analyze_patterns(memories)
        
        # Also detect contradictions
        contradictions = analyzer.detect_contradictions(memories)
        patterns["contradictions"] = contradictions
        
        return {
            "success": True,
            "patterns": patterns
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error analyzing patterns: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{user_id}/graph")
async def get_knowledge_graph(user_id: str, request: Request):
    """Lấy Knowledge Graph với entities và relationships"""
    try:
        await require_auth_for_user(request, user_id)
        from knowledge_graph_service import get_knowledge_graph_service
        
        memory_service = get_memory_service()
        kg_service = get_knowledge_graph_service()
        
        # Get all memories
        result = memory_service.get_all_memories(user_id)
        memories = result.get("results", [])
        
        # Extract knowledge graph
        graph = kg_service.extract_knowledge_graph(memories)
        
        return {
            "success": True,
            "graph": graph
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error getting knowledge graph: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}/{memory_id}")
async def delete_memory(user_id: str, memory_id: str, request: Request):
    """Xóa một memory cụ thể"""
    try:
        await require_auth_for_user(request, user_id)
        service = get_memory_service()
        result = service.delete_memory(memory_id, user_id=user_id)
        return {"success": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error deleting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{user_id}")
async def delete_all_memories(user_id: str, request: Request):
    """Xóa tất cả memories của user"""
    try:
        await require_auth_for_user(request, user_id)
        service = get_memory_service()
        result = service.delete_all_memories(user_id)
        return {"success": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error deleting all: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{user_id}/{memory_id}")
async def update_memory(user_id: str, memory_id: str, data: UpdateMemory, request: Request):
    """Cập nhật nội dung một memory"""
    try:
        await require_auth_for_user(request, user_id)
        service = get_memory_service()
        result = service.update_memory(memory_id, data.new_content, user_id=user_id)
        return {"success": result}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Memory API] Error updating: {e}")
        raise HTTPException(status_code=500, detail=str(e))
