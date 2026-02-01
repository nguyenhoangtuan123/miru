# file: therapist_routes.py
"""
API Routes cho Therapist Dashboard
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service
from auth_middleware import require_auth_for_user, require_auth, require_auth_for_therapist

# Import các routers mới
from therapist_routes_medical import router as medical_router
from therapist_routes_messaging import router as messaging_router
from therapist_routes_appointments import router as appointments_router
from therapist_routes_groups import router as groups_router

router = APIRouter(prefix="/api/therapist", tags=["Therapist"])

# Include các routers con
router.include_router(medical_router)
router.include_router(messaging_router)
router.include_router(appointments_router)
router.include_router(groups_router)


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

@router.get("/profile")
async def get_my_therapist_profile(request: Request):
    """Lấy thông tin therapist profile của user hiện tại"""
    user = await require_auth(request)
    user_id = user.get("sub") or user.get("user_id")
    
    service = get_therapist_service()
    # Find therapist by user_id
    result = service.supabase.table('therapists').select('*').eq('user_id', user_id).execute()
    
    if not result.data:
        raise HTTPException(status_code=404, detail="Therapist profile not found for this user")
    
    return {"success": True, "therapist": result.data[0]}


@router.get("/me/{therapist_id}")
async def get_therapist_info(therapist_id: str, request: Request):
    """Lấy thông tin NTL"""
    await require_auth_for_therapist(request, therapist_id)
    service = get_therapist_service()
    therapist = service.get_therapist(therapist_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    return {"success": True, "therapist": therapist}


@router.get("/clients/{therapist_id}")
async def get_my_clients(therapist_id: str, request: Request):
    """Lấy danh sách thân chủ"""
    await require_auth_for_therapist(request, therapist_id)
    service = get_therapist_service()
    clients = service.get_my_clients(therapist_id)
    return {"success": True, "clients": clients}


@router.post("/clients/{therapist_id}/pair")
async def pair_with_client(therapist_id: str, data: PairClient, request: Request):
    """Ghép cặp với thân chủ mới"""
    await require_auth_for_therapist(request, therapist_id)
    service = get_therapist_service()
    pairing = service.pair_client(therapist_id, data.client_id, data.pairing_code)
    if not pairing:
        raise HTTPException(status_code=400, detail="Failed to pair client")
    return {"success": True, "pairing": pairing}


@router.get("/clients/{therapist_id}/{client_id}/summary")
async def get_client_summary(therapist_id: str, client_id: str, request: Request):
    """Lấy tóm tắt tiến độ của thân chủ"""
    await require_auth_for_therapist(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    summary = service.get_client_summary(client_id)
    return {"success": True, "summary": summary}


# === ASSIGNMENTS ===

@router.get("/assignments/{therapist_id}")
async def get_all_assignments(therapist_id: str, request: Request):
    """Lấy tất cả bài tập NTL đã giao"""
    await require_auth_for_therapist(request, therapist_id)
    service = get_therapist_service()
    assignments = service.get_therapist_assignments(therapist_id)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{therapist_id}")
async def create_assignment(therapist_id: str, data: AssignmentCreate, request: Request):
    """Giao bài tập mới cho thân chủ"""
    await require_auth_for_therapist(request, therapist_id)
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
async def get_client_assignments(client_id: str, request: Request, status: Optional[str] = None):
    """Lấy bài tập của thân chủ (dùng cho cả client view)"""
    await require_auth_for_user(request, client_id)
    service = get_therapist_service()
    assignments = service.get_client_assignments(client_id, status)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, data: AssignmentComplete, request: Request):
    """Thân chủ đánh dấu hoàn thành bài tập"""
    # Verify user is authenticated
    user = await require_auth(request)
    client_id = user.get("sub") or user.get("user_id")
    
    service = get_therapist_service()
    
    # Get assignment and verify it belongs to this client
    assignment_check = service.supabase.table('assignments') \
        .select('id, client_id') \
        .eq('id', assignment_id) \
        .execute()
    
    if not assignment_check.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment_check.data[0]['client_id'] != client_id:
        raise HTTPException(status_code=403, detail="Not authorized to complete this assignment")
    
    assignment = service.complete_assignment(assignment_id, data.completion_notes)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True, "assignment": assignment}


# === CRISIS EVENTS ===

@router.get("/crises/{therapist_id}")
async def get_crisis_events(therapist_id: str, request: Request):
    """Lấy các crisis chưa acknowledged"""
    await require_auth_for_therapist(request, therapist_id)
    service = get_therapist_service()
    crises = service.get_unacknowledged_crises(therapist_id)
    return {"success": True, "crises": crises}


@router.post("/crises/{crisis_id}/acknowledge")
async def acknowledge_crisis(crisis_id: int, data: CrisisAcknowledge, request: Request):
    """NTL xác nhận đã xem crisis"""
    # Verify user is authenticated
    user = await require_auth(request)
    therapist_id = user.get("sub") or user.get("user_id")
    
    service = get_therapist_service()
    
    # Get crisis and verify it belongs to this therapist
    crisis_check = service.supabase.table('crisis_events') \
        .select('id, therapist_id') \
        .eq('id', crisis_id) \
        .execute()
    
    if not crisis_check.data:
        raise HTTPException(status_code=404, detail="Crisis event not found")
    
    if crisis_check.data[0]['therapist_id'] != therapist_id:
        raise HTTPException(status_code=403, detail="Not authorized to acknowledge this crisis")
    
    crisis = service.acknowledge_crisis(crisis_id, data.notes)
    if not crisis:
        raise HTTPException(status_code=404, detail="Crisis event not found")
    return {"success": True, "crisis": crisis}
