from typing import Dict, Any, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_middleware import get_current_user
from profile_service import get_profile_service


router = APIRouter(prefix="/api", tags=["Therapist Contact Requests"])


class TherapistContactRequestCreatePayload(BaseModel):
    therapist_id: str
    message: str = ""
    preferred_contact_method: Optional[str] = None
    client_contact_phone: Optional[str] = None
    client_contact_zalo: Optional[str] = None
    service_interest: Optional[str] = None
    source: Optional[str] = None
    source_article_slug: Optional[str] = None


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


@router.post("/therapist-contact-requests")
async def create_therapist_contact_request(data: TherapistContactRequestCreatePayload, request: Request):
    current_user = await _require_current_user(request)
    try:
        contact_request = get_profile_service().create_contact_request(
            current_user["resolved_user_id"],
            data.therapist_id,
            data.model_dump(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"success": True, "request": contact_request}


@router.get("/therapist-contact-requests/me")
async def get_my_therapist_contact_requests(request: Request):
    current_user = await _require_current_user(request)
    return {
        "success": True,
        "requests": get_profile_service().get_my_contact_requests(current_user["resolved_user_id"]),
    }
