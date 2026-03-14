from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from auth_middleware import get_current_user
from treatment_program_service import (
    TreatmentProgramAccessError,
    TreatmentProgramNotFoundError,
    TreatmentProgramSchemaError,
    TreatmentProgramValidationError,
    get_treatment_program_service,
)

router = APIRouter(tags=["Treatment Programs"])


class TreatmentProgramUpsertPayload(BaseModel):
    title: Optional[str] = None
    approaches: List[str] = Field(default_factory=list)
    summary: Optional[str] = None
    total_sessions: Optional[int] = None
    start_date: Optional[str] = None
    review_date: Optional[str] = None


class TreatmentGoalPayload(BaseModel):
    title: str
    description: Optional[str] = None
    success_criteria: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


class TreatmentGoalUpdatePayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    success_criteria: Optional[str] = None
    status: Optional[str] = None
    order_index: Optional[int] = None


class TreatmentSessionPayload(BaseModel):
    session_number: Optional[int] = None
    title: Optional[str] = None
    objectives: Optional[str] = None
    interventions: Optional[str] = None
    homework_plan: Optional[str] = None
    status: Optional[str] = None
    scheduled_for: Optional[str] = None
    appointment_id: Optional[int] = None
    session_note_id: Optional[int] = None


class TreatmentSessionUpdatePayload(BaseModel):
    session_number: Optional[int] = None
    title: Optional[str] = None
    objectives: Optional[str] = None
    interventions: Optional[str] = None
    homework_plan: Optional[str] = None
    status: Optional[str] = None
    scheduled_for: Optional[str] = None
    appointment_id: Optional[int] = None
    session_note_id: Optional[int] = None


async def _require_user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.get("sub") or user.get("user_id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user")
    return user_id


def _map_error(exc: Exception) -> HTTPException:
    if isinstance(exc, TreatmentProgramAccessError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, TreatmentProgramValidationError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, TreatmentProgramNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, TreatmentProgramSchemaError):
        return HTTPException(status_code=500, detail=str(exc))
    return HTTPException(status_code=500, detail=str(exc))


@router.get("/api/treatment-programs/clients/{client_id}")
async def get_treatment_program_for_therapist(client_id: str, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, **service.get_therapist_program_detail(user_id, client_id)}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.put("/api/treatment-programs/clients/{client_id}")
async def upsert_treatment_program_for_therapist(
    client_id: str,
    payload: TreatmentProgramUpsertPayload,
    request: Request,
):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, **service.upsert_therapist_program(user_id, client_id, payload.model_dump())}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.post("/api/treatment-programs/{program_id}/goals")
async def create_treatment_goal(program_id: int, payload: TreatmentGoalPayload, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, "goal": service.add_goal(user_id, program_id, payload.model_dump())}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.put("/api/treatment-programs/{program_id}/goals/{goal_id}")
async def update_treatment_goal(program_id: int, goal_id: int, payload: TreatmentGoalUpdatePayload, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, "goal": service.update_goal(user_id, program_id, goal_id, payload.model_dump(exclude_none=True))}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.delete("/api/treatment-programs/{program_id}/goals/{goal_id}")
async def delete_treatment_goal(program_id: int, goal_id: int, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": service.delete_goal(user_id, program_id, goal_id)}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.post("/api/treatment-programs/{program_id}/sessions")
async def create_treatment_session(program_id: int, payload: TreatmentSessionPayload, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, "session": service.add_session(user_id, program_id, payload.model_dump())}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.put("/api/treatment-programs/{program_id}/sessions/{session_plan_id}")
async def update_treatment_session(
    program_id: int,
    session_plan_id: int,
    payload: TreatmentSessionUpdatePayload,
    request: Request,
):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {
            "success": True,
            "session": service.update_session(user_id, program_id, session_plan_id, payload.model_dump(exclude_none=True)),
        }
    except Exception as exc:
        raise _map_error(exc) from exc


@router.delete("/api/treatment-programs/{program_id}/sessions/{session_plan_id}")
async def delete_treatment_session(program_id: int, session_plan_id: int, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": service.delete_session(user_id, program_id, session_plan_id)}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.post("/api/treatment-programs/{program_id}/publish")
async def publish_treatment_program(program_id: int, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, **service.publish_program(user_id, program_id)}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.post("/api/treatment-programs/{program_id}/archive")
async def archive_treatment_program(program_id: int, request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": service.archive_program(user_id, program_id)}
    except Exception as exc:
        raise _map_error(exc) from exc


@router.get("/api/treatment-programs/me/current")
async def get_my_current_treatment_program(request: Request):
    user_id = await _require_user_id(request)
    service = get_treatment_program_service()
    try:
        return {"success": True, **service.get_client_current_program(user_id)}
    except Exception as exc:
        raise _map_error(exc) from exc
