"""
Therapist Routes - Medical Profile & Session Notes
API endpoints cho hồ sơ y khoa và ghi chú phiên trị liệu
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service
from auth_middleware import require_auth_for_user

router = APIRouter(tags=["Therapist Medical"])


# === Helper Functions ===

async def verify_therapist_client_relationship(therapist_id: str, client_id: str):
    """Verify that therapist has an active relationship with client"""
    service = get_therapist_service()
    pairing = service.supabase.table('therapist_clients') \
        .select('id') \
        .eq('therapist_id', therapist_id) \
        .eq('client_id', client_id) \
        .eq('status', 'active') \
        .execute()
    
    if not pairing.data:
        raise HTTPException(status_code=403, detail="Not authorized to access this client's data")


# === Pydantic Models ===

class MedicalProfileCreate(BaseModel):
    presenting_problem: Optional[str] = None
    psychiatric_history: Optional[str] = None
    current_medications: Optional[str] = None
    allergies: Optional[str] = None
    dsm5_codes: Optional[List[str]] = []
    treatment_goals: Optional[str] = None
    treatment_plan: Optional[str] = None
    estimated_sessions: Optional[int] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None


class SessionNoteCreate(BaseModel):
    session_date: str
    session_type: Optional[str] = 'online'
    duration_minutes: Optional[int] = None
    session_content: Optional[str] = None
    client_presentation: Optional[str] = None
    interventions_used: Optional[List[str]] = []
    progress_assessment: Optional[str] = None
    mood_observation: Optional[str] = None
    risk_assessment: Optional[str] = None
    next_session_plan: Optional[str] = None
    homework_assigned: Optional[str] = None
    private_notes: Optional[str] = None


class SessionNoteUpdate(BaseModel):
    session_date: Optional[str] = None
    session_type: Optional[str] = None
    duration_minutes: Optional[int] = None
    session_content: Optional[str] = None
    client_presentation: Optional[str] = None
    interventions_used: Optional[List[str]] = None
    progress_assessment: Optional[str] = None
    mood_observation: Optional[str] = None
    risk_assessment: Optional[str] = None
    next_session_plan: Optional[str] = None
    homework_assigned: Optional[str] = None
    private_notes: Optional[str] = None


# === MEDICAL PROFILE ROUTES ===

@router.get("/clients/{therapist_id}/{client_id}/medical-profile")
async def get_medical_profile(therapist_id: str, client_id: str, request: Request):
    """Lấy hồ sơ y khoa của thân chủ"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    profile = service.medical.get_medical_profile(therapist_id, client_id)
    if not profile:
        return {"success": True, "profile": None}
    return {"success": True, "profile": profile}


@router.post("/clients/{therapist_id}/{client_id}/medical-profile")
async def create_or_update_medical_profile(
    therapist_id: str, 
    client_id: str, 
    data: MedicalProfileCreate, 
    request: Request
):
    """Tạo hoặc cập nhật hồ sơ y khoa"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    profile = service.medical.create_or_update_medical_profile(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to save medical profile")
    return {"success": True, "profile": profile}


# === SESSION NOTES ROUTES ===

@router.get("/clients/{therapist_id}/{client_id}/session-notes")
async def get_session_notes(
    therapist_id: str, 
    client_id: str, 
    request: Request,
    limit: int = 50
):
    """Lấy danh sách ghi chú phiên trị liệu"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    notes = service.medical.get_session_notes(therapist_id, client_id, limit)
    return {"success": True, "notes": notes}


@router.get("/session-notes/{therapist_id}/{note_id}")
async def get_session_note(therapist_id: str, note_id: int, request: Request):
    """Lấy chi tiết một ghi chú"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    note = service.medical.get_session_note(note_id, therapist_id)
    if not note:
        raise HTTPException(status_code=404, detail="Session note not found")
    return {"success": True, "note": note}


@router.post("/clients/{therapist_id}/{client_id}/session-notes")
async def create_session_note(
    therapist_id: str, 
    client_id: str, 
    data: SessionNoteCreate, 
    request: Request
):
    """Tạo ghi chú phiên trị liệu mới"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    note = service.medical.create_session_note(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not note:
        raise HTTPException(status_code=400, detail="Failed to create session note")
    return {"success": True, "note": note}


@router.put("/session-notes/{therapist_id}/{note_id}")
async def update_session_note(
    therapist_id: str, 
    note_id: int, 
    data: SessionNoteUpdate, 
    request: Request
):
    """Cập nhật ghi chú phiên trị liệu"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    note = service.medical.update_session_note(
        note_id=note_id,
        therapist_id=therapist_id,
        updates=data.dict(exclude_unset=True)
    )
    if not note:
        raise HTTPException(status_code=404, detail="Session note not found")
    return {"success": True, "note": note}


@router.delete("/session-notes/{therapist_id}/{note_id}")
async def delete_session_note(therapist_id: str, note_id: int, request: Request):
    """Xóa ghi chú phiên trị liệu"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.medical.delete_session_note(note_id, therapist_id)
    return {"success": result}