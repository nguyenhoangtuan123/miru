# file: therapist_routes.py
"""
API Routes cho Therapist Dashboard
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service


router = APIRouter(prefix="/api/therapist", tags=["Therapist"])


# === Pydantic Models ===

class AssignmentCreate(BaseModel):
    client_id: str
    title: str
    description: str
    due_date: Optional[str] = None

class AssignmentComplete(BaseModel):
    completion_notes: Optional[str] = None

class PairClient(BaseModel):
    client_id: str
    pairing_code: Optional[str] = None

class CrisisAcknowledge(BaseModel):
    notes: Optional[str] = None


# === ROUTES ===

@router.get("/me/{therapist_id}")
async def get_therapist_info(therapist_id: str):
    """Lấy thông tin NTL"""
    service = get_therapist_service()
    therapist = service.get_therapist(therapist_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    return {"success": True, "therapist": therapist}


@router.get("/clients/{therapist_id}")
async def get_my_clients(therapist_id: str):
    """Lấy danh sách thân chủ"""
    service = get_therapist_service()
    clients = service.get_my_clients(therapist_id)
    return {"success": True, "clients": clients}


@router.post("/clients/{therapist_id}/pair")
async def pair_with_client(therapist_id: str, data: PairClient):
    """Ghép cặp với thân chủ mới"""
    service = get_therapist_service()
    pairing = service.pair_client(therapist_id, data.client_id, data.pairing_code)
    if not pairing:
        raise HTTPException(status_code=400, detail="Failed to pair client")
    return {"success": True, "pairing": pairing}


@router.get("/clients/{therapist_id}/{client_id}/summary")
async def get_client_summary(therapist_id: str, client_id: str):
    """Lấy tóm tắt tiến độ của thân chủ"""
    service = get_therapist_service()
    summary = service.get_client_summary(client_id)
    return {"success": True, "summary": summary}


# === ASSIGNMENTS ===

@router.get("/assignments/{therapist_id}")
async def get_all_assignments(therapist_id: str):
    """Lấy tất cả bài tập NTL đã giao"""
    service = get_therapist_service()
    assignments = service.get_therapist_assignments(therapist_id)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{therapist_id}")
async def create_assignment(therapist_id: str, data: AssignmentCreate):
    """Giao bài tập mới cho thân chủ"""
    service = get_therapist_service()
    assignment = service.create_assignment(
        therapist_id=therapist_id,
        client_id=data.client_id,
        title=data.title,
        description=data.description,
        due_date=data.due_date
    )
    if not assignment:
        raise HTTPException(status_code=400, detail="Failed to create assignment")
    return {"success": True, "assignment": assignment}


@router.get("/client/{client_id}/assignments")
async def get_client_assignments(client_id: str, status: Optional[str] = None):
    """Lấy bài tập của thân chủ (dùng cho cả client view)"""
    service = get_therapist_service()
    assignments = service.get_client_assignments(client_id, status)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, data: AssignmentComplete):
    """Thân chủ đánh dấu hoàn thành bài tập"""
    service = get_therapist_service()
    assignment = service.complete_assignment(assignment_id, data.completion_notes)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True, "assignment": assignment}


# === CRISIS EVENTS ===

@router.get("/crises/{therapist_id}")
async def get_crisis_events(therapist_id: str):
    """Lấy các crisis chưa acknowledged"""
    service = get_therapist_service()
    crises = service.get_unacknowledged_crises(therapist_id)
    return {"success": True, "crises": crises}


@router.post("/crises/{crisis_id}/acknowledge")
async def acknowledge_crisis(crisis_id: int, data: CrisisAcknowledge):
    """NTL xác nhận đã xem crisis"""
    service = get_therapist_service()
    crisis = service.acknowledge_crisis(crisis_id, data.notes)
    if not crisis:
        raise HTTPException(status_code=404, detail="Crisis event not found")
    return {"success": True, "crisis": crisis}
