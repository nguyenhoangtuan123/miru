from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from assessment_service import (
    AssessmentAccessError,
    AssessmentNotFoundError,
    AssessmentSchemaError,
    AssessmentValidationError,
    get_assessment_service,
)
from auth_middleware import get_current_user

router = APIRouter(prefix="/api/assessments", tags=["Assessments"])


class AssessmentAssignmentCreatePayload(BaseModel):
    client_id: str
    template_id: str
    due_date: Optional[str] = None
    therapist_note: Optional[str] = None


class AssessmentAnswerPayload(BaseModel):
    question_id: str
    answer_value: int = Field(..., ge=0, le=3)


class AssessmentSubmitPayload(BaseModel):
    answers: List[AssessmentAnswerPayload] = Field(default_factory=list)


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
    if isinstance(exc, AssessmentSchemaError):
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if isinstance(exc, AssessmentAccessError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, AssessmentNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, AssessmentValidationError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise exc


@router.get("/templates")
async def list_assessment_templates():
    try:
        templates = get_assessment_service().list_templates()
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "templates": templates}


@router.post("/assignments")
async def create_assessment_assignment(data: AssessmentAssignmentCreatePayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        assignment = get_assessment_service().create_assignment(
            current_user["resolved_user_id"],
            data.model_dump(),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignment": assignment}


@router.get("/therapist/clients/{client_id}")
async def list_therapist_client_assessments(client_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        assignments = get_assessment_service().list_therapist_client_assignments(
            current_user["resolved_user_id"],
            client_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignments": assignments}


@router.get("/therapist/clients/{client_id}/assignments/{assignment_id}")
async def get_therapist_assessment_detail(client_id: str, assignment_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        assignment = get_assessment_service().get_therapist_assignment_detail(
            current_user["resolved_user_id"],
            client_id,
            assignment_id,
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignment": assignment}


@router.get("/my-assignments")
async def list_my_assessments(request: Request):
    current_user = await _require_current_user(request)
    try:
        assignments = get_assessment_service().list_my_assignments(current_user["resolved_user_id"])
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignments": assignments}


@router.get("/my-assignments/{assignment_id}")
async def get_my_assessment_detail(assignment_id: str, request: Request):
    current_user = await _require_current_user(request)
    try:
        assignment = get_assessment_service().get_my_assignment_detail(
            current_user["resolved_user_id"],
            assignment_id,
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignment": assignment}


@router.post("/my-assignments/{assignment_id}/submit")
async def submit_my_assessment(assignment_id: str, data: AssessmentSubmitPayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        assignment = get_assessment_service().submit_assignment(
            current_user["resolved_user_id"],
            assignment_id,
            [answer.model_dump() for answer in data.answers],
        )
    except Exception as exc:
        _raise_service_error(exc)
    return {"success": True, "assignment": assignment}
