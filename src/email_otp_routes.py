"""
Email OTP authentication routes.
Provides passwordless login via 6-digit codes sent through Resend.
"""

import hashlib
import os
import secrets
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from auth import create_access_token
from auth_db import AuthDatabase
from database import DatabaseManager
from auth_intent import (
    AuthIntent,
    apply_role_intent,
    build_final_redirect,
    _sanitize_intent,
    _sanitize_surface,
    _sanitize_return_to,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])

# ---------------------------------------------------------------------------
# Policy constants
# ---------------------------------------------------------------------------
OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "60"))
OTP_MAX_VERIFY_ATTEMPTS = int(os.getenv("OTP_MAX_VERIFY_ATTEMPTS", "5"))
OTP_MAX_SENDS_PER_HOUR = int(os.getenv("OTP_MAX_SENDS_PER_HOUR", "5"))
OTP_CODE_LENGTH = 6

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_code() -> str:
    return "".join(str(secrets.randbelow(10)) for _ in range(OTP_CODE_LENGTH))


def _email_user_id(email: str) -> str:
    """
    Stable deterministic user ID for email-only users.
    Format: email:<sha256-hex-prefix>
    """
    digest = hashlib.sha256(email.lower().strip().encode("utf-8")).hexdigest()[:24]
    return f"email:{digest}"


def _is_resend_available() -> bool:
    try:
        import resend  # noqa: F401
        return bool(os.getenv("RESEND_API_KEY"))
    except ImportError:
        return False


def _send_otp_email(email: str, code: str) -> bool:
    """Send OTP code via the existing Resend infrastructure."""
    from notification_service import get_notification_service

    svc = get_notification_service()
    if not svc.email_enabled:
        logger.warning("[OTP] Email not enabled; code for %s: %s", email, code)
        return True  # In dev, treat as successful

    subject = f"Mã đăng nhập Miru: {code}"
    html = f"""
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
             line-height:1.6;color:#1f2937;max-width:480px;margin:0 auto;padding:20px;">
  <div style="background:linear-gradient(135deg,#7f0df2 0%,#5b21b6 100%);
              padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:white;margin:0;font-size:22px;">Miru – Xác thực đăng nhập</h1>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;
              padding:24px;border-radius:0 0 12px 12px;text-align:center;">
    <p>Mã xác thực của bạn là:</p>
    <div style="font-size:36px;font-weight:700;letter-spacing:8px;
                color:#7f0df2;margin:16px 0;">{code}</div>
    <p style="font-size:14px;color:#6b7280;">
      Mã có hiệu lực trong {OTP_TTL_MINUTES} phút. Không chia sẻ mã này với bất kỳ ai.
    </p>
  </div>
  <div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">
    Miru – Đồng hành cùng sức khỏe tâm thần
  </div>
</body>
</html>
"""
    return svc._send_email(to=email, subject=subject, html=html, tags=["otp-login"])


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RequestCodeBody(BaseModel):
    email: str
    intent: str = "client"
    surface: str = "app"
    return_to: str = "/chat"
    entry: str = ""
    anonymous_id: Optional[str] = None
    session_id: Optional[str] = None


class VerifyCodeBody(BaseModel):
    email: str
    code: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/email/request-code")
async def request_code(body: RequestCodeBody):
    """Send a 6-digit OTP to the given email address."""
    if not _is_resend_available():
        raise HTTPException(status_code=503, detail="Email OTP is not available")

    email = body.email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        raise HTTPException(status_code=400, detail="Invalid email address")

    db = DatabaseManager()
    now = datetime.now(timezone.utc)

    # ── Rate limit: max sends per email per hour ──
    try:
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        count_res = (
            db.supabase.table("auth_email_otps")
            .select("id", count="exact")
            .eq("email", email)
            .gte("created_at", one_hour_ago)
            .execute()
        )
        if count_res.count is not None and count_res.count >= OTP_MAX_SENDS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail="Quá nhiều yêu cầu. Vui lòng thử lại sau.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("[OTP] Rate-limit check failed (continuing): %s", exc)

    # ── Resend cooldown ──
    try:
        cooldown_cutoff = (now - timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS)).isoformat()
        recent_res = (
            db.supabase.table("auth_email_otps")
            .select("id")
            .eq("email", email)
            .gte("created_at", cooldown_cutoff)
            .is_("consumed_at", "null")
            .limit(1)
            .execute()
        )
        if recent_res.data:
            raise HTTPException(
                status_code=429,
                detail=f"Vui lòng đợi {OTP_RESEND_COOLDOWN_SECONDS} giây trước khi gửi lại.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("[OTP] Cooldown check failed (continuing): %s", exc)

    # ── Generate and store code ──
    code = _generate_code()
    code_hash = _hash_code(code)
    expires_at = (now + timedelta(minutes=OTP_TTL_MINUTES)).isoformat()

    try:
        db.supabase.table("auth_email_otps").insert(
            {
                "email": email,
                "code_hash": code_hash,
                "intent": _sanitize_intent(body.intent),
                "surface": _sanitize_surface(body.surface),
                "return_to": body.return_to or "/chat",
                "entry": body.entry or "",
                "anonymous_id": body.anonymous_id,
                "session_id": body.session_id,
                "expires_at": expires_at,
            }
        ).execute()
    except Exception as exc:
        logger.error("[OTP] Failed to store OTP: %s", exc)
        raise HTTPException(status_code=500, detail="Could not create verification code")

    # ── Send email ──
    if not _send_otp_email(email, code):
        raise HTTPException(status_code=500, detail="Could not send verification email")

    return {"success": True, "message": "Mã xác thực đã được gửi đến email của bạn."}


@router.post("/email/verify-code")
async def verify_code(body: VerifyCodeBody):
    """
    Verify a 6-digit OTP.
    On success: creates/updates user, applies role intent, returns redirect URL.
    """
    email = body.email.strip().lower()
    code = body.code.strip()

    if not code or len(code) != OTP_CODE_LENGTH:
        raise HTTPException(status_code=400, detail="Mã không hợp lệ")

    db = DatabaseManager()
    now_iso = datetime.now(timezone.utc).isoformat()

    # ── Look up latest unconsumed OTP for this email ──
    try:
        otp_res = (
            db.supabase.table("auth_email_otps")
            .select("*")
            .eq("email", email)
            .is_("consumed_at", "null")
            .gte("expires_at", now_iso)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("[OTP] DB lookup failed: %s", exc)
        raise HTTPException(status_code=500, detail="Verification failed")

    if not otp_res.data:
        raise HTTPException(status_code=400, detail="Mã đã hết hạn hoặc không tồn tại")

    otp_row = otp_res.data[0]
    otp_id = otp_row["id"]

    # ── Check attempt count ──
    if otp_row.get("attempt_count", 0) >= OTP_MAX_VERIFY_ATTEMPTS:
        # Consume it so it can't be retried
        try:
            db.supabase.table("auth_email_otps").update(
                {"consumed_at": now_iso}
            ).eq("id", otp_id).execute()
        except Exception:
            pass
        raise HTTPException(
            status_code=400,
            detail="Quá số lần thử. Vui lòng yêu cầu mã mới.",
        )

    # ── Increment attempt count ──
    new_count = otp_row.get("attempt_count", 0) + 1
    try:
        db.supabase.table("auth_email_otps").update(
            {"attempt_count": new_count}
        ).eq("id", otp_id).execute()
    except Exception as exc:
        logger.warning("[OTP] Failed to increment attempt count: %s", exc)

    # ── Verify code ──
    if _hash_code(code) != otp_row["code_hash"]:
        remaining = OTP_MAX_VERIFY_ATTEMPTS - new_count
        raise HTTPException(
            status_code=400,
            detail=f"Mã không đúng. Còn {remaining} lần thử.",
        )

    # ── Mark consumed ──
    try:
        db.supabase.table("auth_email_otps").update(
            {"consumed_at": now_iso}
        ).eq("id", otp_id).execute()
    except Exception as exc:
        logger.warning("[OTP] Failed to mark OTP consumed: %s", exc)

    # ── Create / update user ──
    user_id = _email_user_id(email)
    auth_db = AuthDatabase()
    user_data = {
        "id": user_id,
        "email": email,
        "name": email.split("@")[0],
        "picture": None,
    }
    auth_db.create_or_update_user(user_data)

    # ── Apply role intent ──
    intent = AuthIntent(
        intent=otp_row.get("intent", "client"),
        surface=otp_row.get("surface", "app"),
        return_to=otp_row.get("return_to", "/chat"),
        entry=otp_row.get("entry", ""),
        anonymous_id=otp_row.get("anonymous_id"),
        session_id=otp_row.get("session_id"),
    )
    apply_role_intent(db, user_id, intent, user_data)

    # ── Generate token ──
    token = create_access_token(
        user_id=user_id,
        email=email,
        name=user_data["name"],
    )

    # ── Build redirect ──
    redirect_url = build_final_redirect(intent, token)

    return {"success": True, "redirect_url": redirect_url}
