from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_middleware import get_current_user
from intake_service import IntakeSchemaError, IntakeValidationError, get_intake_service

router = APIRouter(prefix="/api/intake", tags=["Intake"])


class IntakeUpdatePayload(BaseModel):
    primary_reason: Optional[str] = None
    overwhelm_level: Optional[str] = None
    support_style: Optional[str] = None
    desired_help_focus: Optional[str] = None
    wants_therapist_connection: bool = False
    memory_note: Optional[str] = None


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


def _raise_service_error(exc: Exception) -> None:
    if isinstance(exc, IntakeSchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, IntakeValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise exc


@router.get("/me")
async def get_my_intake_profile(request: Request):
    current_user = await _require_current_user(request)
    try:
        profile = get_intake_service().get_profile(current_user["resolved_user_id"])
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "profile": profile}


@router.put("/me")
async def update_my_intake_profile(data: IntakeUpdatePayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        profile = get_intake_service().upsert_profile(
            current_user["resolved_user_id"],
            data.model_dump(),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "profile": profile}
