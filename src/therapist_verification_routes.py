from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from auth_middleware import get_current_user
from therapist_verification_service import get_therapist_verification_service

router = APIRouter(tags=["Therapist Verification"])


class TherapistVerificationUpdatePayload(BaseModel):
    verification_full_name: Optional[str] = None
    verification_profession_title: Optional[str] = None
    verification_license_number: Optional[str] = None
    verification_issuing_organization: Optional[str] = None
    verification_note: Optional[str] = None


class TherapistVerificationReviewPayload(BaseModel):
    rejection_reason: Optional[str] = None


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


async def _require_current_user(request: Request) -> Dict[str, Any]:
    current_user = await get_current_user(request)
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not isinstance(user_id, str) or not user_id.strip():
        raise HTTPException(status_code=401, detail="Invalid user")
    current_user["resolved_user_id"] = user_id
    return current_user


async def _require_admin_reviewer(request: Request) -> Dict[str, Any]:
    current_user = await _require_current_user(request)
    email = str(current_user.get("email") or "")
    if not get_therapist_verification_service().is_admin_reviewer(email):
        raise HTTPException(status_code=403, detail="Admin reviewer access required")
    return current_user


async def _require_therapist_role_user(request: Request) -> Dict[str, Any]:
    current_user = await _require_current_user(request)
    if not get_therapist_verification_service().has_therapist_role(current_user["resolved_user_id"]):
        raise HTTPException(status_code=403, detail="Therapist role required")
    return current_user


@router.get("/api/therapist-verification/me")
async def get_my_verification_submission(request: Request):
    current_user = await _require_therapist_role_user(request)
    submission = get_therapist_verification_service().get_my_submission(
        current_user["resolved_user_id"],
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
    )
    if not submission:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")
    return {"success": True, "submission": submission}


@router.put("/api/therapist-verification/me")
async def update_my_verification_submission(data: TherapistVerificationUpdatePayload, request: Request):
    current_user = await _require_therapist_role_user(request)
    submission = get_therapist_verification_service().update_my_submission(
        current_user["resolved_user_id"],
        data.model_dump(exclude_unset=True),
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
    )
    if not submission:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")
    return {"success": True, "submission": submission}


@router.post("/api/therapist-verification/documents")
async def upload_verification_documents(request: Request, files: List[UploadFile] = File(...)):
    current_user = await _require_therapist_role_user(request)
    try:
        submission = get_therapist_verification_service().upload_documents(
            current_user["resolved_user_id"],
            await _prepared_files(files),
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not submission:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")
    return {"success": True, "submission": submission}


@router.delete("/api/therapist-verification/documents/{media_id}")
async def delete_verification_document(media_id: str, request: Request):
    current_user = await _require_therapist_role_user(request)
    submission = get_therapist_verification_service().delete_document(
        current_user["resolved_user_id"],
        media_id,
        email=str(current_user.get("email") or ""),
        name=str(current_user.get("name") or ""),
    )
    if not submission:
        raise HTTPException(status_code=404, detail="Verification document not found")
    return {"success": True, "submission": submission}


@router.post("/api/therapist-verification/submit")
async def submit_verification_for_review(request: Request):
    current_user = await _require_therapist_role_user(request)
    try:
        submission = get_therapist_verification_service().submit_for_review(
            current_user["resolved_user_id"],
            email=str(current_user.get("email") or ""),
            name=str(current_user.get("name") or ""),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not submission:
        raise HTTPException(status_code=400, detail="Therapist profile is unavailable")
    return {"success": True, "submission": submission}


@router.get("/api/admin/therapist-verifications")
async def list_therapist_verifications(request: Request, status: Optional[str] = None):
    await _require_admin_reviewer(request)
    return {
        "success": True,
        "therapists": get_therapist_verification_service().list_reviews(status=status),
    }


@router.get("/api/admin/therapist-verifications/{therapist_id}")
async def get_therapist_verification_detail(therapist_id: str, request: Request):
    await _require_admin_reviewer(request)
    detail = get_therapist_verification_service().get_review_detail(therapist_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Therapist verification not found")
    return {"success": True, "submission": detail}


@router.post("/api/admin/therapist-verifications/{therapist_id}/approve")
async def approve_therapist_verification(therapist_id: str, request: Request):
    current_user = await _require_admin_reviewer(request)
    detail = get_therapist_verification_service().review_submission(
        therapist_id,
        reviewer_email=str(current_user.get("email") or ""),
        approved=True,
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Therapist verification not found")
    return {"success": True, "submission": detail}


@router.post("/api/admin/therapist-verifications/{therapist_id}/reject")
async def reject_therapist_verification(
    therapist_id: str,
    data: TherapistVerificationReviewPayload,
    request: Request,
):
    current_user = await _require_admin_reviewer(request)
    detail = get_therapist_verification_service().review_submission(
        therapist_id,
        reviewer_email=str(current_user.get("email") or ""),
        approved=False,
        rejection_reason=data.rejection_reason,
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Therapist verification not found")
    return {"success": True, "submission": detail}
