
from fastapi import APIRouter, HTTPException, Request
from auth_middleware import require_auth_for_user
from services import journal_manager
from schemas import JournalEntry

router = APIRouter(prefix="/api/journal", tags=["Journal"])

@router.post("/save")
async def save_journal(entry: JournalEntry, request: Request):
    """Save a new journal entry"""
    try:
        await require_auth_for_user(request, entry.user_id)
        result = journal_manager.create_entry(
            user_id=entry.user_id,
            content=entry.content,
            title=entry.title,
            mood=entry.mood,
            tags=entry.tags
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}")
async def get_journals(user_id: str, request: Request, limit: int = 10, offset: int = 0):
    """Get journal entries"""
    try:
        await require_auth_for_user(request, user_id)
        entries = journal_manager.get_entries(user_id, limit, offset)
        return {"success": True, "entries": entries}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{entry_id}")
async def delete_journal(entry_id: int, user_id: str, request: Request):
    """Delete a journal entry"""
    try:
        await require_auth_for_user(request, user_id)
        result = journal_manager.delete_entry(entry_id, user_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
