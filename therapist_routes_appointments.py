"""
Therapist Routes - Appointments
API endpoints cho lịch hẹn trị liệu
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service
from auth_middleware import require_auth_for_user

router = APIRouter(prefix="/api/therapist", tags=["Therapist Appointments"])


# === Pydantic Models ===

class AppointmentCreate(BaseModel):
    client_id: str
    appointment_date: str  # ISO format datetime
    duration_minutes: Optional[int] = 60
    type: Optional[str] = 'online'
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[str] = None
    duration_minutes: Optional[int] = None
    type: Optional[str] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class AppointmentCancel(BaseModel):
    reason: Optional[str] = None


# === APPOINTMENT ROUTES ===

@router.get("/appointments/{therapist_id}")
async def get_appointments(
    therapist_id: str, 
    request: Request,
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Lấy danh sách lịch hẹn"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_appointments(
        therapist_id, client_id, status, from_date, to_date
    )
    return {"success": True, "appointments": appointments}


@router.get("/appointments/{therapist_id}/{appointment_id}")
async def get_appointment(
    therapist_id: str, 
    appointment_id: int, 
    request: Request
):
    """Lấy chi tiết một lịch hẹn"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointment = service.appointment.get_appointment(appointment_id, therapist_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"success": True, "appointment": appointment}


@router.post("/appointments/{therapist_id}")
async def create_appointment(
    therapist_id: str, 
    data: AppointmentCreate, 
    request: Request
):
    """Tạo lịch hẹn mới"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointment = service.appointment.create_appointment(
        therapist_id=therapist_id,
        client_id=data.client_id,
        appointment_date=data.appointment_date,
        duration_minutes=data.duration_minutes,
        type=data.type,
        location=data.location,
        meeting_link=data.meeting_link,
        notes=data.notes
    )
    if not appointment:
        raise HTTPException(status_code=400, detail="Failed to create appointment")
    return {"success": True, "appointment": appointment}


@router.put("/appointments/{therapist_id}/{appointment_id}")
async def update_appointment(
    therapist_id: str, 
    appointment_id: int, 
    data: AppointmentUpdate, 
    request: Request
):
    """Cập nhật lịch hẹn"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointment = service.appointment.update_appointment(
        appointment_id, therapist_id, data.dict(exclude_unset=True)
    )
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"success": True, "appointment": appointment}


@router.post("/appointments/{therapist_id}/{appointment_id}/cancel")
async def cancel_appointment(
    therapist_id: str, 
    appointment_id: int, 
    data: AppointmentCancel, 
    request: Request
):
    """Hủy lịch hẹn"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.appointment.cancel_appointment(
        appointment_id, therapist_id, data.reason
    )
    return {"success": result}


@router.post("/appointments/{therapist_id}/{appointment_id}/complete")
async def complete_appointment(
    therapist_id: str, 
    appointment_id: int, 
    request: Request
):
    """Đánh dấu lịch hẹn đã hoàn thành"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.appointment.complete_appointment(appointment_id, therapist_id)
    return {"success": result}


@router.get("/appointments/{therapist_id}/today")
async def get_today_appointments(therapist_id: str, request: Request):
    """Lấy lịch hẹn hôm nay"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_today_appointments(therapist_id)
    return {"success": True, "appointments": appointments}


@router.get("/appointments/{therapist_id}/upcoming")
async def get_upcoming_appointments(
    therapist_id: str, 
    request: Request,
    days: int = 7
):
    """Lấy lịch hẹn sắp tới"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_upcoming_appointments(therapist_id, days)
    return {"success": True, "appointments": appointments}
