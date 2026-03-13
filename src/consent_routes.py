import json
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth_middleware import require_user_id
from database import DatabaseManager


router = APIRouter(prefix="/api/consent", tags=["Consent"])

CONSENT_VERSION = os.getenv("CONSENT_VERSION", "2026-03-13")
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONSENT_FALLBACK_PATH = os.path.join(PROJECT_ROOT, "user_consents.json")
_consent_file_lock = threading.Lock()


class ConsentAcceptance(BaseModel):
    processing_consent: bool
    crisis_notice_acknowledged: bool
    allow_proactive_support: bool = True


def _default_consent_state() -> Dict[str, Any]:
    return {
        "consent_version": CONSENT_VERSION,
        "accepted": False,
        "accepted_at": None,
        "processing_consent": False,
        "crisis_notice_acknowledged": False,
        "allow_proactive_support": False,
    }


def _is_missing_consents_table(exc: Exception) -> bool:
    message = str(exc).lower()
    return "user_consents" in message and (
        "schema cache" in message
        or "could not find the table" in message
        or "does not exist" in message
    )


def _read_fallback_consents() -> Dict[str, Any]:
    with _consent_file_lock:
        if not os.path.exists(CONSENT_FALLBACK_PATH):
            return {}

        try:
            with open(CONSENT_FALLBACK_PATH, "r", encoding="utf-8") as file:
                data = json.load(file)
                return data if isinstance(data, dict) else {}
        except Exception:
            return {}


def _write_fallback_consents(data: Dict[str, Any]) -> None:
    with _consent_file_lock:
        with open(CONSENT_FALLBACK_PATH, "w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)


def _get_fallback_consent(user_id: str) -> Dict[str, Any]:
    all_consents = _read_fallback_consents()
    consent = all_consents.get(user_id)
    if not isinstance(consent, dict):
        return _default_consent_state()

    return {**_default_consent_state(), **consent, "consent_version": CONSENT_VERSION}


def _save_fallback_consent(user_id: str, consent: Dict[str, Any]) -> Dict[str, Any]:
    all_consents = _read_fallback_consents()
    all_consents[user_id] = consent
    _write_fallback_consents(all_consents)
    return consent


def _normalize_consent(record: Dict[str, Any] | None) -> Dict[str, Any]:
    if not isinstance(record, dict):
        return _default_consent_state()

    consent = {**_default_consent_state(), **record}
    consent["accepted"] = bool(
        consent.get("accepted")
        and consent.get("processing_consent")
        and consent.get("crisis_notice_acknowledged")
    )
    consent["consent_version"] = CONSENT_VERSION
    return consent


def _load_consent(user_id: str) -> Dict[str, Any]:
    db = DatabaseManager()
    try:
        response = (
            db.supabase.table("user_consents")
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if response.data:
            return _normalize_consent(response.data[0])
        return _default_consent_state()
    except Exception as exc:
        if not _is_missing_consents_table(exc):
            raise
        return _get_fallback_consent(user_id)


def _save_consent(user_id: str, payload: ConsentAcceptance) -> Dict[str, Any]:
    if not payload.processing_consent or not payload.crisis_notice_acknowledged:
        raise HTTPException(
            status_code=400,
            detail="Bạn cần chấp thuận xử lý dữ liệu và xác nhận lưu ý khẩn cấp để tiếp tục.",
        )

    now = datetime.now(timezone.utc).isoformat()
    consent = {
        "user_id": user_id,
        "consent_version": CONSENT_VERSION,
        "accepted": True,
        "accepted_at": now,
        "processing_consent": True,
        "crisis_notice_acknowledged": True,
        "allow_proactive_support": bool(payload.allow_proactive_support),
        "updated_at": now,
    }

    db = DatabaseManager()
    try:
        db.supabase.table("user_consents").upsert(
            consent,
            on_conflict="user_id",
        ).execute()
        return _normalize_consent(consent)
    except Exception as exc:
        if not _is_missing_consents_table(exc):
            raise
        return _save_fallback_consent(user_id, consent)


@router.get("/me")
async def get_my_consent(request: Request):
    user_id = await require_user_id(request)
    return {"success": True, "consent": _load_consent(user_id)}


@router.post("/accept")
async def accept_consent(payload: ConsentAcceptance, request: Request):
    user_id = await require_user_id(request)
    return {"success": True, "consent": _save_consent(user_id, payload)}
