from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from auth_middleware import get_current_user
from trajectory_service import (
    TrajectorySchemaError,
    TrajectoryValidationError,
    get_trajectory_service,
)

router = APIRouter(prefix="/api/trajectory", tags=["Trajectory"])


class TrajectoryFeedbackPayload(BaseModel):
    feedback_type: str = Field(..., min_length=1, max_length=50)
    note: Optional[str] = Field(default=None, max_length=1000)


class TrajectoryEventPayload(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=50)
    metadata: Optional[Dict[str, Any]] = None


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
    if isinstance(exc, TrajectorySchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, TrajectoryValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise exc


@router.get("/me/summary")
async def get_my_trajectory_summary(request: Request):
    current_user = await _require_current_user(request)
    try:
        summary = get_trajectory_service().get_summary(
            current_user["resolved_user_id"],
            record_view=True,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "summary": summary}


@router.post("/me/feedback")
async def submit_my_trajectory_feedback(data: TrajectoryFeedbackPayload, request: Request):
    current_user = await _require_current_user(request)
    service = get_trajectory_service()
    try:
        result = service.submit_feedback(
            current_user["resolved_user_id"],
            data.feedback_type,
            data.note,
        )
        summary = service.get_summary(current_user["resolved_user_id"], record_view=False)
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, **result, "summary": summary}


@router.post("/me/events")
async def log_my_trajectory_event(data: TrajectoryEventPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        get_trajectory_service().log_event(
            current_user["resolved_user_id"],
            data.event_type,
            data.metadata,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True}
