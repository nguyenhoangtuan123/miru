"""
Therapist Routes - Messaging
API endpoints cho nhắn tin giữa NTL và thân chủ
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List
from therapist_service import get_therapist_service
from auth_middleware import require_auth_for_user

router = APIRouter(prefix="/api/therapist", tags=["Therapist Messaging"])


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

class MessageCreate(BaseModel):
    client_id: str
    message_content: str
    attachments: Optional[List[dict]] = []


class MarkReadRequest(BaseModel):
    client_id: str


# === MESSAGING ROUTES ===

@router.get("/clients/{therapist_id}/{client_id}/messages")
async def get_messages(
    therapist_id: str, 
    client_id: str, 
    request: Request,
    limit: int = 50
):
    """Lấy lịch sử tin nhắn với thân chủ"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    messages = service.messaging.get_messages(therapist_id, client_id, limit)
    return {"success": True, "messages": messages}


@router.post("/clients/{therapist_id}/{client_id}/messages")
async def send_message(
    therapist_id: str, 
    client_id: str, 
    data: MessageCreate, 
    request: Request
):
    """Gửi tin nhắn cho thân chủ"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
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
    """Đánh dấu tin nhắn đã đọc"""
    await require_auth_for_user(request, therapist_id)
    await verify_therapist_client_relationship(therapist_id, client_id)
    service = get_therapist_service()
    result = service.messaging.mark_messages_as_read(therapist_id, client_id, 'therapist')
    return {"success": result}


@router.get("/{therapist_id}/unread-count")
async def get_unread_count(
    therapist_id: str, 
    request: Request,
    client_id: Optional[str] = None
):
    """Lấy số tin nhắn chưa đọc"""
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
    """Lấy danh sách cuộc trò chuyện gần đây"""
    await require_auth_for_user(request, therapist_id)
    service = get_therapist_service()
    conversations = service.messaging.get_recent_conversations(therapist_id, limit)
    return {"success": True, "conversations": conversations}