
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from services import db_manager
from schemas import GoalCreate, GoalUpdate
from auth_middleware import require_auth_for_user

router = APIRouter(prefix="/api/goals", tags=["Goals"])

@router.post("")
async def create_goal(goal: GoalCreate, request: Request):
    """Create a new goal"""
    await require_auth_for_user(request, goal.user_id)
    try:
        data = {
            "user_id": goal.user_id,
            "title": goal.title,
            "description": goal.description,
            "due_date": goal.due_date,
            "completed": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        result = db_manager.supabase.table("goals").insert(data).execute()
        return {"success": True, "goal": result.data[0] if result.data else None}
    except Exception as e:
        print(f"[Goals] Create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
async def get_goals(user_id: str, request: Request, completed: Optional[bool] = None):
    """Get all goals for a user"""
    await require_auth_for_user(request, user_id)
    try:
        query = db_manager.supabase.table("goals").select("*").eq("user_id", user_id)
        if completed is not None:
            query = query.eq("completed", completed)
        result = query.order("created_at", desc=True).execute()
        return {"success": True, "goals": result.data or []}
    except Exception as e:
        print(f"[Goals] Get error: {e}")
        return {"success": True, "goals": []}

@router.put("/{goal_id}")
async def update_goal(goal_id: int, update: GoalUpdate, request: Request):
    """Update a goal"""
    await require_auth_for_user(request, update.user_id)
    try:
        data = {}
        if update.title is not None:
            data["title"] = update.title
        if update.description is not None:
            data["description"] = update.description
        if update.due_date is not None:
            data["due_date"] = update.due_date
        if update.completed is not None:
            data["completed"] = update.completed
            if update.completed:
                data["completed_at"] = datetime.now(timezone.utc).isoformat()
        
        result = db_manager.supabase.table("goals").update(data).eq("id", goal_id).execute()
        return {"success": True, "goal": result.data[0] if result.data else None}
    except Exception as e:
        print(f"[Goals] Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{goal_id}")
async def delete_goal(goal_id: int, user_id: str, request: Request):
    """Delete a goal"""
    await require_auth_for_user(request, user_id)
    try:
        db_manager.supabase.table("goals").delete().eq("id", goal_id).execute()
        return {"success": True}
    except Exception as e:
        print(f"[Goals] Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
