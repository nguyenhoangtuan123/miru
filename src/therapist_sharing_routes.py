from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_middleware import get_current_user
from therapist_sharing_service import (
    TherapistSharingAccessError,
    TherapistSharingSchemaError,
    TherapistSharingValidationError,
    get_therapist_sharing_service,
)

router = APIRouter(tags=["Therapist Sharing"])


class TherapistSharingUpdatePayload(BaseModel):
    ai_chat_access: Optional[Literal["none", "ai_report", "direct"]] = None
    web_activity_access: Optional[Literal["none", "ai_report", "direct"]] = None
    assessment_access: Optional[Literal["none", "ai_report", "direct"]] = None
    insights_access: Optional[Literal["none", "ai_report", "direct"]] = None


async def _require_user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.get("sub") or user.get("user_id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user")
    return user_id


@router.get("/api/therapist-sharing/me")
async def get_my_therapist_sharing_preferences(request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.list_preferences_for_client(user_id)}
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/api/therapist-sharing/me/{therapist_id}")
async def update_my_therapist_sharing_preferences(
    therapist_id: str,
    payload: TherapistSharingUpdatePayload,
    request: Request,
):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        result = service.update_preference_for_client(user_id, therapist_id, payload.model_dump(exclude_none=True))
        return {"success": True, **result}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/therapist-shared-context/clients/{client_id}/overview")
async def get_therapist_shared_context_overview(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.get_context_overview(user_id, client_id)}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/therapist-shared-context/clients/{client_id}/chat")
async def get_therapist_shared_chat(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.get_group_context(user_id, client_id, "ai_chat")}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/therapist-shared-context/clients/{client_id}/activities")
async def get_therapist_shared_activities(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.get_group_context(user_id, client_id, "web_activity")}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/therapist-shared-context/clients/{client_id}/assessments")
async def get_therapist_shared_assessments(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.get_group_context(user_id, client_id, "assessment_results")}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/therapist-shared-context/clients/{client_id}/insights")
async def get_therapist_shared_insights(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_therapist_sharing_service()
    try:
        return {"success": True, **service.get_group_context(user_id, client_id, "ai_insights")}
    except TherapistSharingAccessError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except TherapistSharingValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except TherapistSharingSchemaError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
