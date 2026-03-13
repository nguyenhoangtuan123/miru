
from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from datetime import datetime, timezone
from auth_middleware import require_auth_for_user, require_user_id
from services import db_manager
from schemas import GoalCreate, GoalUpdate

router = APIRouter(prefix="/api/goals", tags=["Goals"])


def _is_missing_goals_table(exc: Exception) -> bool:
    message = str(exc).lower()
    return "public.goals" in message and (
        "schema cache" in message or "could not find the table" in message
    )

@router.post("")
async def create_goal(goal: GoalCreate, request: Request):
    """Create a new goal"""
    try:
        await require_auth_for_user(request, goal.user_id)
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
    except HTTPException:
        raise
    except Exception as e:
        if _is_missing_goals_table(e):
            raise HTTPException(status_code=503, detail="Goals table is not available")
        print(f"[Goals] Create error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
async def get_goals(user_id: str, request: Request, completed: Optional[bool] = None):
    """Get all goals for a user"""
    try:
        await require_auth_for_user(request, user_id)
        query = db_manager.supabase.table("goals").select("*").eq("user_id", user_id)
        if completed is not None:
            query = query.eq("completed", completed)
        result = query.order("created_at", desc=True).execute()
        return {"success": True, "goals": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        if not _is_missing_goals_table(e):
            print(f"[Goals] Get error: {e}")
        return {"success": True, "goals": []}

@router.put("/{goal_id}")
async def update_goal(goal_id: int, update: GoalUpdate, request: Request):
    """Update a goal"""
    try:
        current_user_id = await require_user_id(request)
        goal_response = db_manager.supabase.table("goals").select("user_id").eq("id", goal_id).limit(1).execute()
        if not goal_response.data:
            raise HTTPException(status_code=404, detail="Goal not found")
        if goal_response.data[0].get("user_id") != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")

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
        
        result = (
            db_manager.supabase.table("goals")
            .update(data)
            .eq("id", goal_id)
            .eq("user_id", current_user_id)
            .execute()
        )
        return {"success": True, "goal": result.data[0] if result.data else None}
    except HTTPException:
        raise
    except Exception as e:
        if _is_missing_goals_table(e):
            raise HTTPException(status_code=503, detail="Goals table is not available")
        print(f"[Goals] Update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{goal_id}")
async def delete_goal(goal_id: int, request: Request):
    """Delete a goal"""
    try:
        current_user_id = await require_user_id(request)
        goal_response = db_manager.supabase.table("goals").select("user_id").eq("id", goal_id).limit(1).execute()
        if not goal_response.data:
            raise HTTPException(status_code=404, detail="Goal not found")
        if goal_response.data[0].get("user_id") != current_user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        db_manager.supabase.table("goals").delete().eq("id", goal_id).eq("user_id", current_user_id).execute()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        if _is_missing_goals_table(e):
            raise HTTPException(status_code=503, detail="Goals table is not available")
        print(f"[Goals] Delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
