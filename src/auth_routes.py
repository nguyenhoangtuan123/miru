"""
Google OAuth routes for authentication
Handles login, callback, logout, and user info endpoints

Also provides:
  GET /auth/providers     – capability discovery
  GET /auth/google/start  – new intent-aware Google login entry
"""
import os
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status
from fastapi.responses import RedirectResponse, JSONResponse
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from google_auth_oauthlib.flow import Flow
from dotenv import load_dotenv

from auth import create_access_token
from auth_db import AuthDatabase
from auth_middleware import get_current_user, create_auth_cookie, clear_auth_cookie
from auth_intent import (
    AuthIntent,
    serialize_intent,
    parse_intent,
    apply_role_intent,
    build_final_redirect,
    _sanitize_return_to,
    _sanitize_intent,
    _sanitize_surface,
)

load_dotenv()

# OAuth Configuration
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
APP_FRONTEND_URL = (
    os.getenv("APP_FRONTEND_URL")
    or os.getenv("NEXT_PUBLIC_APP_URL")
    or os.getenv("FRONTEND_URL")
    or "http://localhost:3000"
)
GOOGLE_OAUTH_CLOCK_SKEW_SECONDS = int(os.getenv("GOOGLE_OAUTH_CLOCK_SKEW_SECONDS", "10"))
GOOGLE_OAUTH_PROMPT = os.getenv("GOOGLE_OAUTH_PROMPT", "select_account")

# OAuth scopes
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

router = APIRouter(prefix="/auth", tags=["authentication"])
auth_db = AuthDatabase()


def serialize_user_response(user_claims: dict, user_data: Optional[dict] = None) -> dict:
    return {
        "id": user_claims.get("sub") or user_claims.get("user_id"),
        "email": (user_data or {}).get("email") or user_claims.get("email"),
        "name": (user_data or {}).get("name") or user_claims.get("name"),
        "picture": (user_data or {}).get("picture") or user_claims.get("picture"),
    }


def sanitize_return_to(return_to: Optional[str]) -> str:
    if not return_to or not return_to.startswith("/") or return_to.startswith("//"):
        return "/chat/"
    return return_to


def append_token(url: str, token: str) -> str:
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}token={token}"


def build_frontend_redirect(path: str) -> str:
    frontend_base = APP_FRONTEND_URL.rstrip("/")
    if not frontend_base:
        return path
    return f"{frontend_base}{path}"


def build_logout_response(next_path: Optional[str] = None):
    redirect_target = build_frontend_redirect(sanitize_return_to(next_path or "/auth/login"))
    response = RedirectResponse(url=redirect_target, status_code=302)
    cookie_config = clear_auth_cookie()
    response.set_cookie(**cookie_config)
    return response


def _build_google_flow(state: Optional[str] = None):
    """Create a Google OAuth Flow instance."""
    kwargs = dict(
        client_config={
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [GOOGLE_REDIRECT_URI],
            }
        },
        scopes=SCOPES,
        redirect_uri=GOOGLE_REDIRECT_URI,
    )
    if state is not None:
        kwargs["state"] = state
    return Flow.from_client_config(**kwargs)


# ──────────────────────────────────────────────────────────────
# Provider discovery
# ──────────────────────────────────────────────────────────────

@router.get("/providers")
async def get_providers():
    """Return which auth providers are currently available."""
    email_otp = False
    try:
        import resend  # noqa: F401
        email_otp = bool(os.getenv("RESEND_API_KEY"))
    except ImportError:
        pass

    return {"google": True, "email_otp": email_otp}


# ──────────────────────────────────────────────────────────────
# Google start (new – full auth intent)
# ──────────────────────────────────────────────────────────────

@router.get("/google/start")
async def google_start(
    intent: Optional[str] = None,
    surface: Optional[str] = None,
    return_to: Optional[str] = None,
    entry: Optional[str] = None,
    anonymous_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """
    Initiate Google OAuth with full auth intent contract.
    All login entry points (app, community) should use this endpoint.
    """
    try:
        auth_intent = AuthIntent(
            intent=_sanitize_intent(intent),
            surface=_sanitize_surface(surface),
            return_to=return_to or ("/therapist" if intent == "therapist" else "/chat"),
            entry=entry or "",
            anonymous_id=anonymous_id,
            session_id=session_id,
        )

        flow = _build_google_flow()
        authorization_kwargs = {
            "access_type": "offline",
            "include_granted_scopes": "true",
            "state": serialize_intent(auth_intent),
        }
        if GOOGLE_OAUTH_PROMPT:
            authorization_kwargs["prompt"] = GOOGLE_OAUTH_PROMPT

        authorization_url, _ = flow.authorization_url(**authorization_kwargs)
        return RedirectResponse(url=authorization_url)

    except Exception as e:
        print(f"OAuth google/start error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate login")


# ──────────────────────────────────────────────────────────────
# Legacy login (backward compat – maps to google/start)
# ──────────────────────────────────────────────────────────────

@router.get("/login")
async def login(next: Optional[str] = None):
    """
    Initiate Google OAuth flow (backward-compatible).
    Maps old `?next=...` to a minimal AuthIntent.
    """
    try:
        auth_intent = AuthIntent(
            intent="client",
            surface="app",
            return_to=sanitize_return_to(next),
            entry="legacy_login",
        )

        flow = _build_google_flow()
        authorization_kwargs = {
            "access_type": "offline",
            "include_granted_scopes": "true",
            "state": serialize_intent(auth_intent),
        }
        if GOOGLE_OAUTH_PROMPT:
            authorization_kwargs["prompt"] = GOOGLE_OAUTH_PROMPT

        authorization_url, _ = flow.authorization_url(**authorization_kwargs)
        return RedirectResponse(url=authorization_url)

    except Exception as e:
        print(f"OAuth login error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate login")


# ──────────────────────────────────────────────────────────────
# OAuth callback (now intent-aware)
# ──────────────────────────────────────────────────────────────

@router.get("/callback")
async def callback(request: Request, code: str, state: str):
    """
    Handle OAuth callback from Google.
    Exchange authorization code for user info, apply role intent, redirect.
    """
    try:
        intent = parse_intent(state)

        # Exchange code for tokens
        flow = _build_google_flow(state=state)
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Verify and decode ID token
        idinfo = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=GOOGLE_OAUTH_CLOCK_SKEW_SECONDS,
        )

        # Extract user info
        user_data = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
        }

        # Persist user
        if not auth_db.create_or_update_user(user_data):
            print("OAuth callback warning: failed to persist user profile to database")

        # Apply role intent (server-side – replaces frontend pending_role)
        try:
            from database import DatabaseManager

            db = DatabaseManager()
            apply_role_intent(db, user_data["id"], intent, user_data)
        except Exception as exc:
            print(f"OAuth callback warning: role intent apply failed: {exc}")

        # Generate JWT
        token = create_access_token(
            user_id=user_data["id"],
            email=user_data["email"],
            name=user_data.get("name"),
        )

        # Build cookie + redirect
        redirect_url = build_final_redirect(intent, token)
        response = RedirectResponse(url=redirect_url, status_code=302)
        cookie_config = create_auth_cookie(token)
        response.set_cookie(**cookie_config)

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


# ──────────────────────────────────────────────────────────────
# Logout
# ──────────────────────────────────────────────────────────────

@router.get("/logout")
async def logout_redirect(next: Optional[str] = None):
    """Logout user and redirect back to frontend."""
    return build_logout_response(next)


@router.post("/logout")
async def logout():
    """Logout user by clearing auth cookie."""
    response = JSONResponse(content={"message": "Logged out successfully"})
    cookie_config = clear_auth_cookie()
    response.set_cookie(**cookie_config)
    return response


# ──────────────────────────────────────────────────────────────
# User info (auth/me – kept for backward compat)
# ──────────────────────────────────────────────────────────────

@router.get("/me")
async def get_me(request: Request):
    """
    Get current authenticated user info
    Protected endpoint for frontend to check auth status
    """
    user = await get_current_user(request)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )

    # Fetch full user data from database when available.
    user_data = auth_db.get_user_by_id(user["sub"])

    if not user_data:
        return serialize_user_response(user)

    return serialize_user_response(user, user_data)
