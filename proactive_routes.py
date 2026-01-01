# file: proactive_routes.py
"""
API Routes cho Proactive AI
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from proactive_service import get_proactive_service


router = APIRouter(prefix="/api/proactive", tags=["Proactive"])


class CheckInRequest(BaseModel):
    user_id: str
    last_active: Optional[str] = None
    include_daily_message: bool = True


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None


@router.post("/check")
async def get_proactive_notifications(request: CheckInRequest):
    """Lấy proactive notifications cho user"""
    try:
        service = get_proactive_service()
        
        # Parse last_active
        last_active = None
        if request.last_active:
            try:
                last_active = datetime.fromisoformat(request.last_active.replace('Z', '+00:00'))
            except:
                pass
        
        notifications = []
        
        # Check inactivity
        if last_active:
            inactivity = service.check_inactivity(request.user_id, last_active)
            if inactivity:
                notifications.append(inactivity)
        
        # Generate daily check-in if requested
        if request.include_daily_message and not notifications:
            checkin = service.generate_daily_checkin(request.user_id)
            notifications.append(checkin)
        
        return {
            "success": True,
            "notifications": notifications
        }
    except Exception as e:
        print(f"[Proactive API] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/daily-message/{user_id}")
async def get_daily_message(user_id: str):
    """Lấy daily check-in message"""
    try:
        from memory_service import get_memory_service
        
        service = get_proactive_service()
        memory_service = get_memory_service()
        
        # Get recent memories for personalization
        try:
            result = memory_service.get_all_memories(user_id)
            memories = result.get("results", [])[:5]
        except:
            memories = []
        
        message = service.generate_daily_checkin(user_id, memories)
        
        return {
            "success": True,
            "message": message
        }
    except Exception as e:
        print(f"[Proactive API] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
