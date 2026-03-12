# file: user_routes.py
"""
API Routes cho User Profile & Privacy Settings
"""

from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any
from user_service import get_user_service
from auth_middleware import require_auth_for_user

router = APIRouter(prefix="/api/users", tags=["Users"])


# === Pydantic Models ===

class ProfileUpdate(BaseModel):
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PrivacySettingsUpdate(BaseModel):
    allow_therapist_chat_history: Optional[bool] = None
    allow_therapist_mood_journal: Optional[bool] = None
    allow_therapist_assignments: Optional[bool] = None
    allow_therapist_goals: Optional[bool] = None
    allow_therapist_memories: Optional[bool] = None
    share_history_days: Optional[int] = None
    notify_when_therapist_access: Optional[bool] = None


class SinglePrivacyUpdate(BaseModel):
    key: str
    value: Any


class ConsentUpdate(BaseModel):
    therapist_id: str
    consent_type: str
    consent_given: bool


class DeletionRequest(BaseModel):
    reason: Optional[str] = None


# === PROFILE ROUTES ===

@router.get("/profile")
async def get_current_user_profile(request: Request):
    """Lấy hồ sơ user từ X-User-Id header (cho therapist UI)"""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        raise HTTPException(status_code=401, detail="X-User-Id header required")
    
    service = get_user_service()
    profile = service.get_user_profile(user_id)
    
    # Nếu không có profile, trả về thông tin cơ bản từ auth
    if not profile:
        from auth_db import AuthDatabase
        auth_db = AuthDatabase()
        basic = auth_db.get_user_by_id(user_id)
        if basic:
            return {
                "success": True,
                "user_id": user_id,
                "display_name": basic.get("name") or basic.get("display_name"),
                "email": basic.get("email")
            }
        return {"success": True, "user_id": user_id, "display_name": "Therapist"}
    
    return {"success": True, **profile}


@router.get("/{user_id}/profile")
async def get_user_profile(user_id: str, request: Request):
    """Lấy hồ sơ mở rộng của user"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    profile = service.get_user_profile(user_id)
    return {"success": True, "profile": profile}


@router.put("/{user_id}/profile")
async def update_user_profile(user_id: str, data: ProfileUpdate, request: Request):
    """Cập nhật hồ sơ user"""
    await require_auth_for_user(request, user_id)
    service = get_user_service()
    profile = service.create_or_update_profile(
        user_id=user_id,
        date_of_birth=data.date_of_birth,
        gender=data.gender,
        phone=data.phone,
        address=data.address,
        emergency_contact_name=data.emergency_contact_name,
        emergency_contact_phone=data.emergency_contact_phone
    )
    return {"success": True, "profile": profile}


@router.delete("/{user_id}/profile")
async def delete_user_profile(user_id: str, request: Request):
    """Xóa hồ sơ mở rộng"""
    await require_auth_for_user(request, user_id)
    service = get_user_service()
    success = service.delete_profile(user_id)
    return {"success": success}


# === PRIVACY SETTINGS ROUTES ===

@router.get("/{user_id}/privacy-settings")
async def get_privacy_settings(user_id: str, request: Request):
    """Lấy cài đặt riêng tư của user"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    settings = service.get_privacy_settings(user_id)
    return {"success": True, "privacy_settings": settings}


@router.put("/{user_id}/privacy-settings")
async def update_privacy_settings(user_id: str, data: PrivacySettingsUpdate, request: Request):
    """Cập nhật tất cả cài đặt riêng tư"""
    await require_auth_for_user(request, user_id)
    service = get_user_service()
    settings = service.create_or_update_privacy_settings(
        user_id=user_id,
        allow_therapist_chat_history=data.allow_therapist_chat_history,
        allow_therapist_mood_journal=data.allow_therapist_mood_journal,
        allow_therapist_assignments=data.allow_therapist_assignments,
        allow_therapist_goals=data.allow_therapist_goals,
        allow_therapist_memories=data.allow_therapist_memories,
        share_history_days=data.share_history_days or 30,
        notify_when_therapist_access=data.notify_when_therapist_access
    )
    return {"success": True, "privacy_settings": settings}


@router.patch("/{user_id}/privacy-settings")
async def update_single_privacy_setting(user_id: str, data: SinglePrivacyUpdate, request: Request):
    """Cập nhật một cài đặt riêng tư duy nhất"""
    await require_auth_for_user(request, user_id)
    service = get_user_service()
    
    try:
        success = service.update_single_privacy_setting(user_id, data.key, data.value)
        if success:
            settings = service.get_privacy_settings(user_id)
            return {"success": True, "privacy_settings": settings}
        raise HTTPException(status_code=400, detail="Failed to update setting")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# === CONSENT MANAGEMENT ===

@router.post("/{user_id}/consent")
async def update_consent(user_id: str, data: ConsentUpdate, request: Request):
    """Cập nhật consent cho therapist cụ thể"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    
    success = service.log_consent_change(
        user_id=user_id,
        therapist_id=data.therapist_id,
        consent_type=data.consent_type,
        consent_given=data.consent_given
    )
    
    if success:
        settings = service.get_privacy_settings(user_id)
        return {"success": True, "privacy_settings": settings}
    raise HTTPException(status_code=400, detail="Failed to update consent")


# === DATA ACCESS (for Therapist) ===

@router.get("/{user_id}/therapist-access")
async def get_therapist_accessible_data(
    user_id: str,
    therapist_id: str = Query(...),
    request: Request = None
):
    """
    Lấy dữ liệu mà therapist có thể truy cập
    Dựa trên privacy settings của user
    """
    # Note: In production, verify therapist has access to this client
    service = get_user_service()
    accessible = service.get_therapist_accessible_data(user_id, therapist_id)
    return {"success": True, "access": accessible}


# === DATA EXPORT (GDPR) ===

@router.get("/{user_id}/export-data")
async def export_user_data(user_id: str, request: Request):
    """Xuất tất cả dữ liệu của user (GDPR data portability)"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    data = service.export_user_data(user_id)
    return {"success": True, "export": data}


# === ACCOUNT DELETION ===

@router.post("/{user_id}/delete-request")
async def request_account_deletion(user_id: str, data: DeletionRequest, request: Request):
    """Yêu cầu xóa tài khoản (GDPR right to erasure)"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    
    result = service.create_deletion_request(user_id, data.reason)
    
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    
    return {
        "success": True,
        "message": "Deletion request submitted. Your data will be deleted in 30 days.",
        "deletion_request": result
    }


@router.delete("/{user_id}/delete-request")
async def cancel_deletion_request(user_id: str, request: Request):
    """Hủy yêu cầu xóa tài khoản"""
    user = await require_auth_for_user(request, user_id)
    service = get_user_service()
    success = service.cancel_deletion_request(user_id)
    return {"success": success, "message": "Deletion request cancelled"}


# === FULL USER INFO ===

@router.get("/{user_id}/full")
async def get_full_user_info(user_id: str, request: Request):
    """Lấy tất cả thông tin user (basic + profile + privacy)"""
    user = await require_auth_for_user(request, user_id)
    
    from auth_db import AuthDatabase
    auth_db = AuthDatabase()
    basic_info = auth_db.get_user_by_id(user_id)
    
    service = get_user_service()
    profile = service.get_user_profile(user_id)
    privacy = service.get_privacy_settings(user_id)
    
    return {
        "success": True,
        "user": {
            "basic_info": basic_info,
            "profile": profile,
            "privacy_settings": privacy
        }
    }


# === CLIENT-THERAPIST CONNECTION ===

@router.get("/{user_id}/my-therapist")
async def get_client_therapist(user_id: str, request: Request):
    """Lấy thông tin therapist của client (từ phía client)"""
    from therapist_service import get_therapist_service
    
    service = get_therapist_service()
    pairing = service.get_client_therapist(user_id)
    
    if not pairing:
        return {"success": True, "therapist": None}
    
    # Get therapist details
    therapist = service.get_therapist(pairing.get('therapist_id'))
    
    return {
        "success": True,
        "therapist": {
            "id": therapist.get('id') if therapist else None,
            "name": therapist.get('name') if therapist else None,
            "email": therapist.get('email') if therapist else None,
            "specializations": therapist.get('specializations') if therapist else None
        } if therapist else None,
        "paired_at": pairing.get('created_at'),
        "is_active": pairing.get('is_active', True)
    }


@router.delete("/{user_id}/my-therapist")
async def disconnect_from_therapist(user_id: str, request: Request):
    """Client ngắt kết nối với therapist"""
    user = await require_auth_for_user(request, user_id)
    
    from therapist_service import get_therapist_service
    
    service = get_therapist_service()
    pairing = service.get_client_therapist(user_id)
    
    if not pairing:
        raise HTTPException(status_code=404, detail="No therapist connection found")
    
    # Unpair client from therapist
    success = service.unpair_client(
        therapist_id=pairing['therapist_id'],
        client_id=user_id
    )
    
    if success:
        return {"success": True, "message": "Disconnected from therapist"}
    else:
        raise HTTPException(status_code=400, detail="Failed to disconnect")
