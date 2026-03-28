"""
Shared auth intent contract.
Encapsulates the login intent, signed-state encoding/decoding,
role-application helper, and final-redirect builder that all
auth providers (Google, Email OTP) share.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass, asdict
from typing import Optional
from urllib.parse import urlparse, urlencode, urlunparse, parse_qs

from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

APP_FRONTEND_URL = (
    os.getenv("APP_FRONTEND_URL")
    or os.getenv("NEXT_PUBLIC_APP_URL")
    or os.getenv("FRONTEND_URL")
    or "http://localhost:3000"
).rstrip("/")

OAUTH_STATE_MAX_AGE_SECONDS = int(os.getenv("OAUTH_STATE_MAX_AGE_SECONDS", "1800"))

ALLOWED_COMMUNITY_ORIGINS: set[str] = set()
for _raw in (
    os.getenv("COMMUNITY_ALLOWED_ORIGINS", ""),
    os.getenv("NEXT_PUBLIC_SITE_URL", ""),
    "http://localhost:3001",
    "https://miruai-web.vercel.app",
):
    _val = _raw.strip().rstrip("/")
    if _val:
        ALLOWED_COMMUNITY_ORIGINS.add(_val)


# ---------------------------------------------------------------------------
# AuthIntent data class
# ---------------------------------------------------------------------------

@dataclass
class AuthIntent:
    intent: str = "client"         # "client" | "therapist"
    surface: str = "app"           # "app" | "community"
    return_to: str = "/chat"
    entry: str = ""
    anonymous_id: Optional[str] = None
    session_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Sanitization
# ---------------------------------------------------------------------------

def _sanitize_return_to(return_to: Optional[str], default: str = "/chat") -> str:
    if not return_to or not return_to.startswith("/") or return_to.startswith("//"):
        return default
    return return_to


def _sanitize_intent(raw: Optional[str]) -> str:
    return raw if raw in ("client", "therapist") else "client"


def _sanitize_surface(raw: Optional[str]) -> str:
    return raw if raw in ("app", "community") else "app"


# ---------------------------------------------------------------------------
# Signed state for OAuth / cross-request token
# ---------------------------------------------------------------------------

def _get_state_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")


def serialize_intent(intent: AuthIntent) -> str:
    """Encode an AuthIntent into a signed, URL-safe string."""
    payload = {
        "intent": _sanitize_intent(intent.intent),
        "surface": _sanitize_surface(intent.surface),
        "return_to": _sanitize_return_to(intent.return_to),
        "entry": intent.entry or "",
        "iat": int(time.time()),
        "nonce": secrets.token_urlsafe(16),
    }
    if intent.anonymous_id:
        payload["anonymous_id"] = intent.anonymous_id
    if intent.session_id:
        payload["session_id"] = intent.session_id

    payload_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_json).rstrip(b"=")
    signature = hmac.new(
        _get_state_secret().encode("utf-8"),
        payload_b64,
        hashlib.sha256,
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{payload_b64.decode('utf-8')}.{signature_b64.decode('utf-8')}"


def parse_intent(state: str) -> AuthIntent:
    """Decode and verify a signed state string back into an AuthIntent."""
    try:
        payload_part, signature_part = state.split(".", 1)
        payload_bytes = payload_part.encode("utf-8")
        expected_sig = hmac.new(
            _get_state_secret().encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        provided_sig = base64.urlsafe_b64decode(
            signature_part + "=" * (-len(signature_part) % 4)
        )
        if not hmac.compare_digest(expected_sig, provided_sig):
            raise ValueError("Invalid state signature")

        payload_json = base64.urlsafe_b64decode(
            payload_part + "=" * (-len(payload_part) % 4)
        )
        payload = json.loads(payload_json.decode("utf-8"))

        issued_at = int(payload.get("iat", 0))
        if not issued_at or (time.time() - issued_at) > OAUTH_STATE_MAX_AGE_SECONDS:
            raise ValueError("State expired")

        return AuthIntent(
            intent=_sanitize_intent(payload.get("intent")),
            surface=_sanitize_surface(payload.get("surface")),
            return_to=_sanitize_return_to(payload.get("return_to")),
            entry=payload.get("entry", ""),
            anonymous_id=payload.get("anonymous_id"),
            session_id=payload.get("session_id"),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid state parameter") from exc


# ---------------------------------------------------------------------------
# Role-apply helper  (extracted from app.py set_user_role)
# ---------------------------------------------------------------------------

def _is_schema_error(exc: Exception, fragment: str) -> bool:
    return fragment.lower() in str(exc).lower()


def apply_role_intent(db, user_id: str, intent: AuthIntent, user_claims: dict) -> str:
    """
    Persist the requested role for *user_id*.
    Returns the role that was actually applied ("client" or "therapist").
    This is the shared helper used by both Google callback and Email OTP verify.
    """
    role = _sanitize_intent(intent.intent)

    # 1. Upsert into user_profiles
    persisted = False
    try:
        db.supabase.table("user_profiles").upsert(
            {"user_id": user_id, "role": role},
            on_conflict="user_id",
        ).execute()
        persisted = True
    except Exception as exc:
        if not _is_schema_error(exc, "user_profiles"):
            print(f"[auth_intent] Error saving role to user_profiles: {exc}")
        # Fallback: try users table
        try:
            db.supabase.table("users").update({"role": role}).eq("id", user_id).execute()
            persisted = True
        except Exception as exc2:
            if not _is_schema_error(exc2, "users"):
                print(f"[auth_intent] Error saving role to users: {exc2}")

    # 2. If therapist, ensure therapist profile exists
    if persisted and role == "therapist":
        try:
            from therapist_service import get_therapist_service

            service = get_therapist_service()
            therapist = service.ensure_therapist_profile(
                user_id=user_id,
                email=user_claims.get("email", ""),
                name=user_claims.get("name", ""),
            )
            if therapist:
                try:
                    from datetime import datetime, timezone

                    db.supabase.table("therapists").update(
                        {
                            "verification_status": therapist.get("verification_status") or "not_submitted",
                            "is_verified": bool(therapist.get("is_verified")),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    ).eq("id", therapist["id"]).execute()
                except Exception:
                    pass
                print(f"[auth_intent] Therapist profile ready for {user_id}")
        except Exception as exc:
            print(f"[auth_intent] Error creating therapist profile: {exc}")

    return role


# ---------------------------------------------------------------------------
# Final redirect builder
# ---------------------------------------------------------------------------

def _is_allowed_community_origin(url: str) -> bool:
    """Check whether a full URL belongs to an allowed community origin."""
    try:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}".rstrip("/")
        if origin in ALLOWED_COMMUNITY_ORIGINS:
            return True
        # Allow any *.vercel.app preview deploy
        if parsed.hostname and parsed.hostname.endswith(".vercel.app"):
            return True
    except Exception:
        pass
    return False


def build_final_redirect(intent: AuthIntent, token: str) -> str:
    """
    Build the post-auth redirect URL.
    - surface=app  → {APP_FRONTEND_URL}/auth/callback?token=...&next=...
    - surface=community → {return_to}?miru_token=...
    """
    if intent.surface == "community":
        # return_to should be a full URL pointing at the community origin
        return_to = intent.return_to or "/"
        if return_to.startswith("http"):
            if not _is_allowed_community_origin(return_to):
                # Safety: fall back to app
                return f"{APP_FRONTEND_URL}/auth/callback?token={token}&next=%2Fchat"
            separator = "&" if "?" in return_to else "?"
            return f"{return_to}{separator}miru_token={token}"
        # Relative path — cannot redirect to community with just a path,
        # fall back to app callback
        return f"{APP_FRONTEND_URL}/auth/callback?token={token}&next={return_to}"

    # surface=app (default)
    return_to = _sanitize_return_to(intent.return_to)
    return (
        f"{APP_FRONTEND_URL}/auth/callback"
        f"?token={token}"
        f"&next={return_to}"
    )
