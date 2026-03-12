"""
Therapist Routes - All API endpoints consolidated
With full security: auth, relationship verification, audit logging
"""

from fastapi import APIRouter, HTTPException, Request
from typing import Optional

# Import service and models
from ..service import get_therapist_service
from ..models import (
    PairClientRequest, AssignmentCreate, AssignmentComplete, BulkAssignmentCreate,
    CrisisAcknowledge, AppointmentCreate, AppointmentUpdate, AppointmentCancel,
    MessageCreate, MarkReadRequest, MedicalProfileCreate, SessionNoteCreate,
    SessionNoteUpdate, GroupCreate, GroupUpdate, AddClientToGroup,
    ProgressMetricCreate, TreatmentOutcomeCreate
)
from ..security import require_auth, require_auth_for_user


# Main router
router = APIRouter(prefix="/api/therapist", tags=["Therapist"])


# === Helper: Verify therapist-client relationship ===

async def verify_relationship(therapist_id: str, client_id: str):
    """Verify therapist has active relationship with client"""
    service = get_therapist_service()
    service.security.verify_client_relationship(therapist_id, client_id)


# === THERAPIST INFO ===

@router.get("/me/{therapist_id}")
async def get_therapist_info(therapist_id: str, request: Request):
    """Get therapist info"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    therapist = service.get_therapist(therapist_id)
    if not therapist:
        raise HTTPException(status_code=404, detail="Therapist not found")
    return {"success": True, "therapist": therapist}


# === CLIENT MANAGEMENT ===

@router.get("/clients/{therapist_id}")
async def get_my_clients(therapist_id: str, request: Request):
    """Get list of therapist's clients"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    clients = service.get_my_clients(therapist_id)
    return {"success": True, "clients": clients}


@router.post("/clients/{therapist_id}/pair")
async def pair_with_client(therapist_id: str, data: PairClientRequest, request: Request):
    """Pair therapist with new client"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    pairing = service.pair_client(therapist_id, data.client_id, data.pairing_code)
    if not pairing:
        raise HTTPException(status_code=400, detail="Failed to pair client")
    
    # Audit log
    service.security.log_sensitive_action(
        therapist_id, data.client_id, 'edit', 'therapist_clients', request=request
    )
    return {"success": True, "pairing": pairing}


@router.get("/clients/{therapist_id}/{client_id}/summary")
async def get_client_summary(therapist_id: str, client_id: str, request: Request):
    """Get client progress summary"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    summary = service.get_client_summary(client_id)
    
    # Audit log
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'client_summary', request=request
    )
    return {"success": True, "summary": summary}


# === ASSIGNMENTS ===

@router.get("/assignments/{therapist_id}")
async def get_all_assignments(therapist_id: str, request: Request):
    """Get all assignments created by therapist"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    assignments = service.get_therapist_assignments(therapist_id)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{therapist_id}")
async def create_assignment(therapist_id: str, data: AssignmentCreate, request: Request):
    """Create new assignment for client"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, data.client_id)
    
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
    
    service.security.log_sensitive_action(
        therapist_id, data.client_id, 'edit', 'assignments', 
        resource_id=assignment.get('id'), request=request
    )
    return {"success": True, "assignment": assignment}


@router.post("/assignments/{therapist_id}/bulk")
async def create_bulk_assignments(therapist_id: str, data: BulkAssignmentCreate, request: Request):
    """Create same assignment for multiple clients"""
    await require_auth_for_user(request, therapist_id)
    
    service = get_therapist_service()
    
    # Verify all relationships
    for client_id in data.client_ids:
        await verify_relationship(therapist_id, client_id)
    
    assignments = service.create_bulk_assignments(
        therapist_id=therapist_id,
        client_ids=data.client_ids,
        title=data.title,
        description=data.description,
        due_date=data.due_date
    )
    
    # Log for each client
    for client_id in data.client_ids:
        service.security.log_sensitive_action(
            therapist_id, client_id, 'edit', 'assignments', request=request
        )
    
    return {"success": True, "assignments": assignments, "count": len(assignments)}


@router.get("/client/{client_id}/assignments")
async def get_client_assignments(client_id: str, request: Request, status: Optional[str] = None):
    """Get client's assignments (client view)"""
    await require_auth_for_user(request, client_id)
    service = get_therapist_service()
    assignments = service.get_client_assignments(client_id, status)
    return {"success": True, "assignments": assignments}


@router.post("/assignments/{assignment_id}/complete")
async def complete_assignment(assignment_id: int, data: AssignmentComplete, request: Request):
    """Client marks assignment as completed"""
    user = await require_auth(request)
    client_id = user.get("sub") or user.get("user_id")
    
    service = get_therapist_service()
    
    # Verify assignment belongs to this client
    assignment_check = service.supabase.table('assignments') \
        .select('id, client_id') \
        .eq('id', assignment_id) \
        .execute()
    
    if not assignment_check.data:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if assignment_check.data[0]['client_id'] != client_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    assignment = service.complete_assignment(assignment_id, data.completion_notes)
    return {"success": True, "assignment": assignment}


# === CRISIS EVENTS ===

@router.get("/crises/{therapist_id}")
async def get_crisis_events(therapist_id: str, request: Request):
    """Get unacknowledged crises"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    crises = service.get_unacknowledged_crises(therapist_id)
    return {"success": True, "crises": crises}


@router.post("/crises/{crisis_id}/acknowledge")
async def acknowledge_crisis(crisis_id: int, data: CrisisAcknowledge, request: Request):
    """Therapist acknowledges crisis"""
    user = await require_auth(request)
    therapist_id = user.get("sub") or user.get("user_id")
    
    service = get_therapist_service()
    
    # Verify crisis belongs to this therapist
    crisis_check = service.supabase.table('crisis_events') \
        .select('id, therapist_id, client_id') \
        .eq('id', crisis_id) \
        .execute()
    
    if not crisis_check.data:
        raise HTTPException(status_code=404, detail="Crisis not found")
    
    if crisis_check.data[0]['therapist_id'] != therapist_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    crisis = service.acknowledge_crisis(crisis_id, data.notes)
    
    # Audit log
    service.security.log_sensitive_action(
        therapist_id, crisis_check.data[0]['client_id'], 
        'edit', 'crisis_events', resource_id=crisis_id, request=request
    )
    return {"success": True, "crisis": crisis}


# === APPOINTMENTS ===

@router.get("/appointments/{therapist_id}")
async def get_appointments(
    therapist_id: str, 
    request: Request,
    client_id: Optional[str] = None,
    status: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None
):
    """Get appointments list"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_appointments(
        therapist_id, client_id, status, from_date, to_date
    )
    return {"success": True, "appointments": appointments}


@router.get("/appointments/{therapist_id}/today")
async def get_today_appointments(therapist_id: str, request: Request):
    """Get today's appointments"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_today_appointments(therapist_id)
    return {"success": True, "appointments": appointments}


@router.get("/appointments/{therapist_id}/upcoming")
async def get_upcoming_appointments(therapist_id: str, request: Request, days: int = 7):
    """Get upcoming appointments"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointments = service.appointment.get_upcoming_appointments(therapist_id, days)
    return {"success": True, "appointments": appointments}


@router.get("/appointments/{therapist_id}/{appointment_id}")
async def get_appointment(therapist_id: str, appointment_id: int, request: Request):
    """Get appointment details"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    appointment = service.appointment.get_appointment(appointment_id, therapist_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"success": True, "appointment": appointment}


@router.post("/appointments/{therapist_id}")
async def create_appointment(therapist_id: str, data: AppointmentCreate, request: Request):
    """Create new appointment"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, data.client_id)
    
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
    
    service.security.log_sensitive_action(
        therapist_id, data.client_id, 'edit', 'appointments',
        resource_id=appointment.get('id'), request=request
    )
    return {"success": True, "appointment": appointment}


@router.put("/appointments/{therapist_id}/{appointment_id}")
async def update_appointment(
    therapist_id: str, 
    appointment_id: int, 
    data: AppointmentUpdate, 
    request: Request
):
    """Update appointment"""
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
    """Cancel appointment"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.appointment.cancel_appointment(appointment_id, therapist_id, data.reason)
    return {"success": result}


@router.post("/appointments/{therapist_id}/{appointment_id}/complete")
async def complete_appointment(therapist_id: str, appointment_id: int, request: Request):
    """Mark appointment as completed"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.appointment.complete_appointment(appointment_id, therapist_id)
    return {"success": result}


# === MESSAGING ===

@router.get("/clients/{therapist_id}/{client_id}/messages")
async def get_messages(
    therapist_id: str, 
    client_id: str, 
    request: Request,
    limit: int = 50
):
    """Get messages with client"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    messages = service.messaging.get_messages(therapist_id, client_id, limit)
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'messages', request=request
    )
    return {"success": True, "messages": messages}


@router.post("/clients/{therapist_id}/{client_id}/messages")
async def send_message(
    therapist_id: str, 
    client_id: str, 
    data: MessageCreate, 
    request: Request
):
    """Send message to client"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    message = service.messaging.send_message(
        therapist_id=therapist_id,
        client_id=client_id,
        sender_type='therapist',
        message_content=data.message_content,
        attachments=data.attachments
    )
    if not message:
        raise HTTPException(status_code=400, detail="Failed to send message")
    return {"success": True, "message": message}


@router.post("/clients/{therapist_id}/{client_id}/messages/mark-read")
async def mark_messages_as_read(
    therapist_id: str, 
    client_id: str,
    data: MarkReadRequest,
    request: Request
):
    """Mark messages as read"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    result = service.messaging.mark_messages_as_read(therapist_id, client_id, 'therapist')
    return {"success": result}


@router.get("/{therapist_id}/unread-count")
async def get_unread_count(
    therapist_id: str, 
    request: Request,
    client_id: Optional[str] = None
):
    """Get unread message count"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    count = service.messaging.get_unread_message_count(therapist_id, client_id)
    return {"success": True, "unread_count": count}


@router.get("/{therapist_id}/conversations")
async def get_recent_conversations(
    therapist_id: str, 
    request: Request,
    limit: int = 20
):
    """Get recent conversations"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    conversations = service.messaging.get_recent_conversations(therapist_id, limit)
    return {"success": True, "conversations": conversations}


# === MEDICAL PROFILE ===

@router.get("/clients/{therapist_id}/{client_id}/medical-profile")
async def get_medical_profile(therapist_id: str, client_id: str, request: Request):
    """Get client's medical profile"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    profile = service.medical.get_medical_profile(therapist_id, client_id)
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'medical_profile', request=request
    )
    return {"success": True, "profile": profile}


@router.post("/clients/{therapist_id}/{client_id}/medical-profile")
async def create_or_update_medical_profile(
    therapist_id: str, 
    client_id: str, 
    data: MedicalProfileCreate, 
    request: Request
):
    """Create or update medical profile"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    profile = service.medical.create_or_update_medical_profile(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to save medical profile")
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'edit', 'medical_profile',
        resource_id=profile.get('id'), request=request
    )
    return {"success": True, "profile": profile}


# === SESSION NOTES ===

@router.get("/clients/{therapist_id}/{client_id}/session-notes")
async def get_session_notes(
    therapist_id: str, 
    client_id: str, 
    request: Request,
    limit: int = 50
):
    """Get session notes"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    notes = service.medical.get_session_notes(therapist_id, client_id, limit)
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'session_notes', request=request
    )
    return {"success": True, "notes": notes}


@router.get("/session-notes/{therapist_id}/{note_id}")
async def get_session_note(therapist_id: str, note_id: int, request: Request):
    """Get specific session note"""
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
    """Create session note"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    note = service.medical.create_session_note(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not note:
        raise HTTPException(status_code=400, detail="Failed to create session note")
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'edit', 'session_notes',
        resource_id=note.get('id'), request=request
    )
    return {"success": True, "note": note}


@router.put("/session-notes/{therapist_id}/{note_id}")
async def update_session_note(
    therapist_id: str, 
    note_id: int, 
    data: SessionNoteUpdate, 
    request: Request
):
    """Update session note"""
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
    """Delete session note"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.medical.delete_session_note(note_id, therapist_id)
    return {"success": result}


# === CLIENT GROUPS ===

@router.get("/client-groups/{therapist_id}")
async def get_client_groups(therapist_id: str, request: Request):
    """Get client groups"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    groups = service.groups.get_client_groups(therapist_id)
    return {"success": True, "groups": groups}


@router.get("/client-groups/{therapist_id}/{group_id}")
async def get_client_group(therapist_id: str, group_id: int, request: Request):
    """Get group details"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.get_client_group(group_id, therapist_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "group": group}


@router.post("/client-groups/{therapist_id}")
async def create_client_group(therapist_id: str, data: GroupCreate, request: Request):
    """Create client group"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.create_client_group(
        therapist_id=therapist_id,
        name=data.name,
        description=data.description,
        color=data.color
    )
    if not group:
        raise HTTPException(status_code=400, detail="Failed to create group")
    return {"success": True, "group": group}


@router.put("/client-groups/{therapist_id}/{group_id}")
async def update_client_group(
    therapist_id: str, 
    group_id: int, 
    data: GroupUpdate, 
    request: Request
):
    """Update client group"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    group = service.groups.update_client_group(
        group_id, therapist_id, data.dict(exclude_unset=True)
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return {"success": True, "group": group}


@router.delete("/client-groups/{therapist_id}/{group_id}")
async def delete_client_group(therapist_id: str, group_id: int, request: Request):
    """Delete client group"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.groups.delete_client_group(group_id, therapist_id)
    return {"success": result}


@router.post("/client-groups/{therapist_id}/{group_id}/members")
async def add_client_to_group(
    therapist_id: str, 
    group_id: int, 
    data: AddClientToGroup, 
    request: Request
):
    """Add client to group"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, data.client_id)
    
    service = get_therapist_service()
    try:
        member = service.groups.add_client_to_group(group_id, data.client_id, therapist_id)
        return {"success": True, "member": member}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/client-groups/{therapist_id}/{group_id}/members/{client_id}")
async def remove_client_from_group(
    therapist_id: str, 
    group_id: int, 
    client_id: str, 
    request: Request
):
    """Remove client from group"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    result = service.groups.remove_client_from_group(group_id, client_id, therapist_id)
    return {"success": result}


@router.get("/clients/{therapist_id}/{client_id}/groups")
async def get_client_groups_for_client(
    therapist_id: str, 
    client_id: str, 
    request: Request
):
    """Get groups that client belongs to"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    groups = service.groups.get_client_groups_for_client(client_id, therapist_id)
    return {"success": True, "groups": groups}


# === PROGRESS METRICS ===

@router.get("/clients/{therapist_id}/{client_id}/progress-metrics")
async def get_progress_metrics(
    therapist_id: str, 
    client_id: str, 
    request: Request,
    limit: int = 10
):
    """Get client progress metrics"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    metrics = service.get_progress_metrics(therapist_id, client_id, limit)
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'progress_metrics', request=request
    )
    return {"success": True, "metrics": metrics}


@router.post("/clients/{therapist_id}/{client_id}/progress-metrics")
async def create_progress_metric(
    therapist_id: str, 
    client_id: str, 
    data: ProgressMetricCreate, 
    request: Request
):
    """Create progress metric"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    metric = service.create_progress_metric(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not metric:
        raise HTTPException(status_code=400, detail="Failed to create progress metric")
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'edit', 'progress_metrics',
        resource_id=metric.get('id'), request=request
    )
    return {"success": True, "metric": metric}


# === TREATMENT OUTCOMES ===

@router.get("/clients/{therapist_id}/{client_id}/treatment-outcome")
async def get_treatment_outcome(therapist_id: str, client_id: str, request: Request):
    """Get treatment outcome"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    outcome = service.get_treatment_outcome(therapist_id, client_id)
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'view', 'treatment_outcome', request=request
    )
    return {"success": True, "outcome": outcome}


@router.post("/clients/{therapist_id}/{client_id}/treatment-outcome")
async def create_or_update_treatment_outcome(
    therapist_id: str, 
    client_id: str, 
    data: TreatmentOutcomeCreate, 
    request: Request
):
    """Create or update treatment outcome"""
    await require_auth_for_user(request, therapist_id)
    await verify_relationship(therapist_id, client_id)
    
    service = get_therapist_service()
    outcome = service.create_or_update_treatment_outcome(
        therapist_id=therapist_id,
        client_id=client_id,
        **data.dict()
    )
    if not outcome:
        raise HTTPException(status_code=400, detail="Failed to save treatment outcome")
    
    service.security.log_sensitive_action(
        therapist_id, client_id, 'edit', 'treatment_outcome',
        resource_id=outcome.get('id'), request=request
    )
    return {"success": True, "outcome": outcome}


# === AUDIT LOGS ===

@router.get("/audit/{therapist_id}")
async def get_audit_logs(
    therapist_id: str,
    request: Request,
    client_id: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 100
):
    """Get audit logs (therapist's own access logs)"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    logs = service.get_audit_logs(
        therapist_id=therapist_id,
        client_id=client_id,
        from_date=from_date,
        to_date=to_date,
        limit=limit
    )
    return {"success": True, "logs": logs}
