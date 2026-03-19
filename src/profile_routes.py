from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from auth_middleware import get_current_user
from profile_service import get_profile_service
from therapist_service import get_therapist_service

router = APIRouter(prefix="/api/profiles", tags=["Profiles"])


class TherapistProfileUpdatePayload(BaseModel):
    display_name: Optional[str] = None
    headline: Optional[str] = None
    bio: Optional[str] = None
    specializations: Optional[List[str]] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    contact_zalo_url: Optional[str] = None
    contact_facebook_url: Optional[str] = None
    contact_website_url: Optional[str] = None
    is_public: Optional[bool] = None
    accepting_new_clients: Optional[bool] = None
    service_mode: Optional[str] = None
    starting_price_vnd: Optional[int] = None
    pricing_unit: Optional[str] = None
    pricing_note: Optional[str] = None
    public_payment_note: Optional[str] = None
    public_workflow_steps: Optional[List[str]] = None


class TherapistBillingProfilePayload(BaseModel):
    payment_mode: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    momo_phone: Optional[str] = None
    transfer_note: Optional[str] = None


class ClientProfileUpdatePayload(BaseModel):
    intro: Optional[str] = None


class TherapistContactRequestCreatePayload(BaseModel):
    therapist_id: str
    message: str = ""
    preferred_contact_method: Optional[str] = None
    client_contact_phone: Optional[str] = None
    client_contact_zalo: Optional[str] = None
    service_interest: Optional[str] = None
    source: Optional[str] = None


class TherapistContactRequestHandlePayload(BaseModel):
    therapist_reply: Optional[str] = None
    share_pairing_code: bool = False


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


async def _require_therapist_user(request: Request) -> Dict[str, Any]:
    current_user = await _require_current_user(request)
    therapist_id = get_therapist_service()._resolve_therapist_id(current_user["resolved_user_id"])
    if not therapist_id:
        raise HTTPException(status_code=403, detail="Therapist access required")
    current_user["resolved_therapist_id"] = therapist_id
    return current_user


def _prepared_file(file: UploadFile, content: bytes) -> Dict[str, Any]:
    return {
        "filename": file.filename or "upload.bin",
        "mime_type": file.content_type,
        "size": len(content),
        "content": content,
    }


async def _prepared_files(files: List[UploadFile]) -> List[Dict[str, Any]]:
    prepared: List[Dict[str, Any]] = []
    for file in files:
        content = await file.read()
        prepared.append(_prepared_file(file, content))
    return prepared


@router.get("/therapists/public")
async def list_public_therapists(limit: Optional[int] = None):
    return {"success": True, "therapists": get_profile_service().get_public_therapists(limit=limit)}


@router.get("/therapists/public/{therapist_id}")
async def get_public_therapist_profile(therapist_id: str):
    profile = get_profile_service().get_public_therapist(therapist_id, track_view=True)
    if not profile:
        raise HTTPException(status_code=404, detail="Public therapist profile not found")
    return {"success": True, "profile": profile}


@router.get("/me/therapist")
async def get_my_therapist_profile(request: Request):
    current_user = await _require_therapist_user(request)
    profile = get_profile_service().get_my_therapist_profile(
        current_user["resolved_user_id"],
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
        picture=str(current_user.get("picture") or ""),
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")
    return {"success": True, "profile": profile}


@router.put("/me/therapist")
async def update_my_therapist_profile(data: TherapistProfileUpdatePayload, request: Request):
    current_user = await _require_therapist_user(request)
    try:
        profile = get_profile_service().update_my_therapist_profile(
            current_user["resolved_user_id"],
            data.model_dump(exclude_unset=True),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
            picture=str(current_user.get("picture") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to update therapist profile")
    return {"success": True, "profile": profile}


@router.get("/me/therapist/billing")
async def get_my_therapist_billing_profile(request: Request):
    current_user = await _require_therapist_user(request)
    profile = get_profile_service().get_my_therapist_billing_profile(
        current_user["resolved_user_id"],
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Therapist billing profile is unavailable")
    return {"success": True, "profile": profile}


@router.put("/me/therapist/billing")
async def update_my_therapist_billing_profile(data: TherapistBillingProfilePayload, request: Request):
    current_user = await _require_therapist_user(request)
    profile = get_profile_service().update_my_therapist_billing_profile(
        current_user["resolved_user_id"],
        data.model_dump(exclude_unset=True),
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to update therapist billing profile")
    return {"success": True, "profile": profile}


@router.post("/me/therapist/avatar")
async def upload_my_therapist_avatar(request: Request, file: UploadFile = File(...)):
    current_user = await _require_therapist_user(request)
    content = await file.read()
    try:
        profile = get_profile_service().upload_my_therapist_avatar(
            current_user["resolved_user_id"],
            _prepared_file(file, content),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
            picture=str(current_user.get("picture") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to upload therapist avatar")
    return {"success": True, "profile": profile}


@router.post("/me/therapist/certificates")
async def upload_my_therapist_certificates(request: Request, files: List[UploadFile] = File(...)):
    current_user = await _require_therapist_user(request)
    try:
        profile = get_profile_service().upload_my_therapist_certificates(
            current_user["resolved_user_id"],
            await _prepared_files(files),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
            picture=str(current_user.get("picture") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to upload therapist certificates")
    return {"success": True, "profile": profile}


@router.delete("/me/therapist/media/{media_id}")
async def delete_my_therapist_media(media_id: str, request: Request):
    current_user = await _require_therapist_user(request)
    profile = get_profile_service().delete_my_therapist_media(
        current_user["resolved_user_id"],
        media_id,
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
        picture=str(current_user.get("picture") or ""),
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Therapist media not found")
    return {"success": True, "profile": profile}


@router.get("/me/client")
async def get_my_client_profile(request: Request):
    current_user = await _require_current_user(request)
    profile = get_profile_service().get_my_client_profile(
        current_user["resolved_user_id"],
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
        picture=str(current_user.get("picture") or ""),
    )
    return {"success": True, "profile": profile}


@router.put("/me/client")
async def update_my_client_profile(data: ClientProfileUpdatePayload, request: Request):
    current_user = await _require_current_user(request)
    profile = get_profile_service().update_my_client_profile(
        current_user["resolved_user_id"],
        data.model_dump(exclude_unset=True),
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
        picture=str(current_user.get("picture") or ""),
    )
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to update client profile")
    return {"success": True, "profile": profile}


@router.post("/me/client/avatar")
async def upload_my_client_avatar(request: Request, file: UploadFile = File(...)):
    current_user = await _require_current_user(request)
    content = await file.read()
    try:
        profile = get_profile_service().upload_my_client_avatar(
            current_user["resolved_user_id"],
            _prepared_file(file, content),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
            picture=str(current_user.get("picture") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to upload client avatar")
    return {"success": True, "profile": profile}


@router.post("/me/client/gallery")
async def upload_my_client_gallery(request: Request, files: List[UploadFile] = File(...)):
    current_user = await _require_current_user(request)
    try:
        profile = get_profile_service().upload_my_client_gallery(
            current_user["resolved_user_id"],
            await _prepared_files(files),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
            picture=str(current_user.get("picture") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not profile:
        raise HTTPException(status_code=400, detail="Failed to upload client gallery")
    return {"success": True, "profile": profile}


@router.delete("/me/client/media/{media_id}")
async def delete_my_client_media(media_id: str, request: Request):
    current_user = await _require_current_user(request)
    profile = get_profile_service().delete_my_client_media(
        current_user["resolved_user_id"],
        media_id,
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
        picture=str(current_user.get("picture") or ""),
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Client media not found")
    return {"success": True, "profile": profile}


@router.get("/clients/{client_id}")
async def get_client_profile_for_therapist(client_id: str, request: Request):
    current_user = await _require_therapist_user(request)
    profile = get_profile_service().get_client_profile_for_therapist(current_user["resolved_user_id"], client_id)
    if not profile:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"success": True, "profile": profile}
