from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from auth_middleware import get_current_user
from push_service import get_push_service
from therapist_service import get_therapist_service


router = APIRouter(prefix="/api/therapist", tags=["Therapist"])

ALLOWED_ASSIGNMENT_UPLOAD_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "video/mp4",
    "image/jpeg",
    "image/png",
}
ALLOWED_ASSIGNMENT_UPLOAD_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".mp3",
    ".m4a",
    ".mp4",
    ".jpg",
    ".jpeg",
    ".png",
}
MAX_ASSIGNMENT_UPLOAD_BYTES = 40 * 1024 * 1024


class ChecklistItemPayload(BaseModel):
    id: Optional[str] = None
    label: str


class AssignmentCreate(BaseModel):
    client_id: str
    title: str
    description: str
    type: str = "task"
    priority: str = "medium"
    due_date: Optional[str] = None
    checklist_items: List[ChecklistItemPayload] = Field(default_factory=list)


class AssignmentComplete(BaseModel):
    completion_notes: Optional[str] = None


class AssignmentProgressUpdate(BaseModel):
    checked_item_ids: List[str] = Field(default_factory=list)
    completion_notes: Optional[str] = None


class PairClient(BaseModel):
    client_id: str
    pairing_code: Optional[str] = None


class PairingCodeConnect(BaseModel):
    pairing_code: str


class CrisisAcknowledge(BaseModel):
    notes: Optional[str] = None


class TherapistMessageCreate(BaseModel):
    message_content: str
    attachments: Optional[List[Dict[str, Any]]] = None


class AppointmentCreate(BaseModel):
    client_id: str
    appointment_date: str
    duration_minutes: int = 60
    appointment_type: str = "online"
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    notes: Optional[str] = None


class AppointmentCancel(BaseModel):
    reason: Optional[str] = None


async def _require_user_id(request: Request) -> str:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = user.get("sub") or user.get("user_id")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user")
    return user_id


async def _require_client_access(request: Request, client_id: str) -> str:
    current_user_id = await _require_user_id(request)
    if current_user_id != client_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return current_user_id


async def _require_therapist_access(request: Request, therapist_id: str):
    service = get_therapist_service()
    current_user_id = await _require_user_id(request)
    current_therapist_id = service._resolve_therapist_id(current_user_id)
    requested_therapist_id = service._resolve_therapist_id(therapist_id)
    if not current_therapist_id or not requested_therapist_id or current_therapist_id != requested_therapist_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return service, requested_therapist_id


def _ensure_relationship(service, therapist_id: str, client_id: str):
    if not service.has_active_relationship(therapist_id, client_id):
        raise HTTPException(status_code=403, detail="No active therapist-client relationship")


def _send_push_best_effort(user_id: Optional[str], title: str, body: str, url: str, tag: str):
    if not isinstance(user_id, str) or not user_id:
        return
    try:
        get_push_service().send_push_to_user(
            user_id=user_id,
            title=title,
            body=body,
            url=url,
            tag=tag,
        )
    except Exception:
        pass


def _validate_assignment_upload(file: UploadFile, size: int):
    filename = (file.filename or "").strip()
    extension = f".{filename.rsplit('.', 1)[-1].lower()}" if "." in filename else ""
    mime_type = (file.content_type or "").strip().lower()

    if size <= 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if size > MAX_ASSIGNMENT_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Uploaded file exceeds the 40 MB limit")
    if extension not in ALLOWED_ASSIGNMENT_UPLOAD_EXTENSIONS and mime_type not in ALLOWED_ASSIGNMENT_UPLOAD_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")


@router.get("/me/{therapist_id}")
async def get_therapist_info(therapist_id: str, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    therapist = service.get_therapist(therapist_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    return {"success": True, "therapist": therapist}


@router.get("/clients/{therapist_id}")
async def get_my_clients(therapist_id: str, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "clients": service.get_my_clients(therapist_id)}


@router.post("/clients/{therapist_id}/pair")
async def pair_with_client(therapist_id: str, data: PairClient, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    pairing = service.pair_client(therapist_id, data.client_id, data.pairing_code)
    if not pairing:
        raise HTTPException(status_code=400, detail="Failed to pair client")
    return {"success": True, "pairing": pairing}


@router.post("/clients/{therapist_id}/pair-code")
async def create_pairing_code(therapist_id: str, request: Request):
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    current_user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(current_user_id, str):
        raise HTTPException(status_code=401, detail="Invalid user")

    service = get_therapist_service()
    therapist = service.ensure_therapist_profile(
        current_user_id,
        email=current_user.get("email") or "",
        name=current_user.get("name") or "Therapist",
    )
    if not therapist:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")

    current_therapist_id = service._resolve_therapist_id(current_user_id)
    requested_therapist_id = service._resolve_therapist_id(therapist_id)
    if requested_therapist_id and current_therapist_id and requested_therapist_id != current_therapist_id:
        raise HTTPException(status_code=403, detail="Access denied")

    pairing = service.create_pairing_code(current_user_id)
    if not pairing:
        raise HTTPException(status_code=400, detail="Failed to create pairing code")
    return {"success": True, "pairing": pairing}


@router.get("/clients/{therapist_id}/{client_id}/summary")
async def get_client_summary(therapist_id: str, client_id: str, request: Request):
    service, resolved_therapist_id = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, resolved_therapist_id, client_id)
    return {"success": True, "summary": service.get_client_summary(client_id)}


@router.get("/clients/{therapist_id}/{client_id}/assignments")
async def get_client_assignments_for_therapist(
    therapist_id: str,
    client_id: str,
    request: Request,
    status: Optional[str] = None,
):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, client_id)
    return {"success": True, "assignments": service.get_client_assignments(client_id, status)}


@router.get("/clients/{therapist_id}/{client_id}/messages")
async def get_therapist_messages(therapist_id: str, client_id: str, request: Request, limit: int = 50):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, client_id)
    return {"success": True, "messages": service.get_messages(therapist_id, client_id, limit)}


@router.post("/clients/{therapist_id}/{client_id}/messages")
async def send_therapist_message(therapist_id: str, client_id: str, data: TherapistMessageCreate, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, client_id)
    message = service.send_message(therapist_id, client_id, "therapist", data.message_content, data.attachments)
    if not message:
        raise HTTPException(status_code=400, detail="Failed to send message")
    _send_push_best_effort(
        client_id,
        "Nhà trị liệu vừa nhắn tin",
        data.message_content[:140],
        "/therapy",
        "therapist-message",
    )
    return {"success": True, "message": message}


@router.post("/clients/{therapist_id}/{client_id}/messages/mark-read")
async def mark_therapist_messages_read(therapist_id: str, client_id: str, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, client_id)
    return {"success": service.mark_messages_as_read(therapist_id, client_id, "client")}


@router.get("/conversations/{therapist_id}")
async def get_therapist_conversations(therapist_id: str, request: Request, limit: int = 20):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "conversations": service.get_recent_conversations(therapist_id, limit)}


@router.get("/unread-count/{therapist_id}")
async def get_therapist_unread_count(therapist_id: str, request: Request, client_id: Optional[str] = None):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "count": service.get_unread_message_count(therapist_id, client_id)}


@router.get("/appointments/{therapist_id}")
async def get_appointments(therapist_id: str, request: Request, client_id: Optional[str] = None, status: Optional[str] = None):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "appointments": service.get_appointments(therapist_id, client_id, status)}


@router.post("/appointments/{therapist_id}")
async def create_appointment(therapist_id: str, data: AppointmentCreate, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, data.client_id)
    appointment = service.create_appointment(
        therapist_id,
        data.client_id,
        data.appointment_date,
        data.duration_minutes,
        data.appointment_type,
        data.location,
        data.meeting_link,
        data.notes,
    )
    if not appointment:
        raise HTTPException(status_code=400, detail="Failed to create appointment")
    return {"success": True, "appointment": appointment}


@router.post("/appointments/{therapist_id}/{appointment_id}/cancel")
async def cancel_appointment(therapist_id: str, appointment_id: int, data: AppointmentCancel, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": service.cancel_appointment(appointment_id, therapist_id, data.reason)}


@router.post("/appointments/{therapist_id}/{appointment_id}/complete")
async def complete_appointment(therapist_id: str, appointment_id: int, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": service.complete_appointment(appointment_id, therapist_id)}


@router.get("/assignments/{therapist_id}")
async def get_all_assignments(therapist_id: str, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "assignments": service.get_therapist_assignments(therapist_id)}


@router.post("/assignments/{therapist_id}")
async def create_assignment(therapist_id: str, data: AssignmentCreate, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    _ensure_relationship(service, therapist_id, data.client_id)
    assignment = service.create_assignment(
        therapist_id,
        data.client_id,
        data.title,
        data.description,
        assignment_type=data.type,
        priority=data.priority,
        due_date=data.due_date,
        checklist_items=[item.model_dump() for item in data.checklist_items],
    )
    if not assignment:
        raise HTTPException(status_code=400, detail="Failed to create assignment")
    _send_push_best_effort(
        data.client_id,
        "Bạn có bài tập mới",
        data.title[:140],
        "/therapy",
        "assignment-created",
    )
    return {"success": True, "assignment": assignment}


@router.get("/client/{client_id}/assignments")
async def get_client_assignments(client_id: str, request: Request, status: Optional[str] = None):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    return {"success": True, "assignments": service.get_client_assignments(client_id, status)}


@router.patch("/assignments/{assignment_id}/progress")
async def update_assignment_progress(assignment_id: int, data: AssignmentProgressUpdate, request: Request):
    service = get_therapist_service()
    current_user_id = await _require_user_id(request)
    assignment = service.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    therapist_id = assignment.get("therapist_id")
    client_id = assignment.get("client_id")
    current_therapist_id = service._resolve_therapist_id(current_user_id)
    allowed = current_user_id == client_id or (
        isinstance(therapist_id, str) and current_therapist_id == therapist_id
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied")

    updated = service.update_assignment_progress(
        assignment_id,
        checked_item_ids=data.checked_item_ids,
        completion_notes=data.completion_notes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True, "assignment": updated}


@router.post("/assignments/{assignment_id}/attachments")
async def upload_assignment_attachments(
    assignment_id: int,
    request: Request,
    files: List[UploadFile] = File(...),
):
    service = get_therapist_service()
    current_user_id = await _require_user_id(request)
    assignment = service.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    if assignment.get("client_id") != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    prepared_files: List[Dict[str, Any]] = []
    for file in files:
        content = await file.read()
        _validate_assignment_upload(file, len(content))
        prepared_files.append(
            {
                "filename": file.filename or "upload.bin",
                "mime_type": file.content_type,
                "size": len(content),
                "content": content,
            }
        )

    updated = service.add_assignment_submission_attachments(
        assignment_id,
        current_user_id,
        prepared_files,
    )
    if not updated:
        raise HTTPException(status_code=400, detail="Failed to upload assignment attachments")
    return {"success": True, "assignment": updated}


@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, data: AssignmentComplete, request: Request):
    service = get_therapist_service()
    current_user_id = await _require_user_id(request)
    assignment = service.get_assignment(assignment_id)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    therapist_id = assignment.get("therapist_id")
    client_id = assignment.get("client_id")
    current_therapist_id = service._resolve_therapist_id(current_user_id)
    allowed = current_user_id == client_id or (
        isinstance(therapist_id, str) and current_therapist_id == therapist_id
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Access denied")
    total_steps = int(assignment.get("total_steps") or 0)
    completed_steps = int(assignment.get("completed_steps") or 0)
    if total_steps > 0 and completed_steps < total_steps:
        raise HTTPException(status_code=400, detail="Please complete all checklist items first")
    assignment = service.complete_assignment(assignment_id, data.completion_notes)
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return {"success": True, "assignment": assignment}


@router.get("/crises/{therapist_id}")
async def get_crisis_events(therapist_id: str, request: Request):
    service, _ = await _require_therapist_access(request, therapist_id)
    return {"success": True, "crises": service.get_unacknowledged_crises(therapist_id)}


@router.post("/crises/{crisis_id}/acknowledge")
async def acknowledge_crisis(crisis_id: int, data: CrisisAcknowledge, request: Request):
    service = get_therapist_service()
    current_user_id = await _require_user_id(request)
    crisis = service.get_crisis_event(crisis_id)
    if not crisis:
        raise HTTPException(status_code=404, detail="Crisis event not found")
    crisis_therapist_id = crisis.get("therapist_id")
    current_therapist_id = service._resolve_therapist_id(current_user_id)
    if not isinstance(crisis_therapist_id, str) or current_therapist_id != crisis_therapist_id:
        raise HTTPException(status_code=403, detail="Access denied")
    crisis = service.acknowledge_crisis(crisis_id, data.notes)
    if not crisis:
        raise HTTPException(status_code=404, detail="Crisis event not found")
    return {"success": True, "crisis": crisis}


@router.post("/client/{client_id}/connect")
async def connect_client_to_therapist(client_id: str, data: PairingCodeConnect, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    pairing = service.connect_client_by_code(client_id, data.pairing_code)
    if not pairing:
        raise HTTPException(status_code=400, detail="Invalid or expired pairing code")
    return {"success": True, "pairing": pairing}


@router.get("/client/{client_id}/therapist")
async def get_client_therapist(client_id: str, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    pairing = service.get_client_therapist(client_id)
    return {"success": True, "pairing": pairing}


@router.get("/client/{client_id}/messages")
async def get_client_messages(client_id: str, request: Request, limit: int = 50):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    return {"success": True, "messages": service.get_client_messages(client_id, limit)}


@router.post("/client/{client_id}/messages")
async def send_client_message(client_id: str, data: TherapistMessageCreate, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    message = service.send_client_message(client_id, data.message_content, data.attachments)
    if not message:
        raise HTTPException(status_code=400, detail="Failed to send message")
    pairing = service.get_client_therapist(client_id)
    therapist = service.get_therapist(str(pairing.get("therapist_id"))) if pairing else None
    _send_push_best_effort(
        therapist.get("user_id") if isinstance(therapist, dict) else None,
        "Than chu vua nhan tin",
        data.message_content[:140],
        "/therapist/messages",
        "client-message",
    )
    return {"success": True, "message": message}


@router.post("/client/{client_id}/messages/mark-read")
async def mark_client_messages_read(client_id: str, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    return {"success": service.mark_client_messages_as_read(client_id)}


@router.get("/client/{client_id}/appointments")
async def get_client_appointments(client_id: str, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    return {"success": True, "appointments": service.get_client_appointments(client_id)}


@router.post("/client/{client_id}/appointments/{appointment_id}/confirm")
async def confirm_client_appointment(client_id: str, appointment_id: int, request: Request):
    await _require_client_access(request, client_id)
    service = get_therapist_service()
    return {"success": service.confirm_client_appointment(client_id, appointment_id)}
