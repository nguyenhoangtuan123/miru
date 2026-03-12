# file: proactive_routes.py
"""
API Routes cho Proactive AI
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime, timezone
from proactive_service import get_proactive_service


router = APIRouter(prefix="/api/proactive", tags=["Proactive"])


class CheckInRequest(BaseModel):
    user_id: str
    session_id: Optional[Any] = None
    last_active: Optional[str] = None
    include_daily_message: bool = True

class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    due_date: Optional[str] = None


@router.post("/check")
async def get_proactive_notifications(request: CheckInRequest):
    """
    Lấy proactive notifications cho user.
    Sử dụng Main Chat Agent để sinh nội dung có ngữ cảnh.
    """
    try:
        from agent_graph import run_agent
        from proactive_service import get_proactive_service
        from services import chat_manager
        
        service = get_proactive_service()
        
        # 1. Parse last_active
        last_active = None
        if request.last_active:
            try:
                last_active = datetime.fromisoformat(request.last_active.replace('Z', '+00:00'))
            except:
                pass
        
        notifications = []
        
        # 2. Check inactivity logic (reuse service for calculation)
        if last_active:
            # Calculate inactive time
            now = datetime.now(timezone.utc)
            if last_active.tzinfo is None:
                last_active = last_active.replace(tzinfo=timezone.utc)
            
            inactive_hours = (now - last_active).total_seconds() / 3600
            
            # Threshold Check (e.g. 72 hours, or just check daily if triggered manually)
            # For testing: we assume if this API is called by frontend, the timer has passed
            
            is_inactive = inactive_hours > 0.1 # Simple check, frontend handles the timer
            
            if is_inactive:
                print(f"[INFO] [Proactive] User inactive for {inactive_hours:.1f} hours. Triggering Agent...")
                
                # 3. Construct System Trigger Prompt
                # This prompt acts as a "Fake User Message" or "System Injection" to the Agent
                trigger_prompt = f"""
[SYSTEM EVENT: PROACTIVE CHECK-IN]
User has been inactive for {int(inactive_hours/24)} days (or {int(inactive_hours)} hours).
The user is technically NOT sending this message. THIS IS A SYSTEM TRIGGER.

YOUR TASK:
Generate a proactive, warm, and short check-in message for the user.
- Use your memories about them (name, job, recent issues).
- If they had a specific problem recently, ask gently about it.
- If not, just say hello and wish them a good day based on current time.
- Keep it under 2 sentences.
- Be extremely natural, like a friend texting first.
"""
                
                # Get session ID provided by frontend, or None
                session_id = request.session_id
                
                # 4. Run Main Agent
                agent_result = await run_agent(
                    user_id=request.user_id,
                    user_message=trigger_prompt,
                    session_id=session_id, # Pass session_id so agent can update facts if needed
                    conversation_history=[] # No history for this specific trigger
                )
                
                message = agent_result.get("response", "Hôm nay bạn thế nào?")
                
                # 5. Save to Database (if session_id available)
                if session_id:
                    try:
                        session_id_int = int(session_id)
                        save_res = chat_manager.save_message(session_id_int, request.user_id, "ai", message)
                        print(f"[SUCCESS] [Proactive] Saved message to session {session_id_int}: {save_res}")
                    except Exception as e:
                        print(f"[WARN] [Proactive] Failed to save message: {e}")
                
                # 6. Format response
                notifications.append({
                    "type": "inactivity_check",
                    "inactive_hours": inactive_hours,
                    "message": message,
                    "priority": "high",
                    "actions": [
                        {"label": "💬 Trò chuyện ngay", "action": "chat"},
                        {"label": "👋 Check-in cảm xúc", "action": "mood_checkin"}
                    ]
                })

        return {
            "success": True,
            "notifications": notifications
        }
    except Exception as e:
        print(f"[Proactive API] Error: {e}")
        import traceback
        traceback.print_exc()
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
