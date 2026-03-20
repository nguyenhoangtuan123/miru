"""
Google OAuth routes for authentication
Handles login, callback, logout, and user info endpoints
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
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
OAUTH_STATE_MAX_AGE_SECONDS = int(os.getenv("OAUTH_STATE_MAX_AGE_SECONDS", "1800"))


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


def _get_oauth_state_secret() -> str:
    return os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")


def create_signed_oauth_state(return_to: str) -> str:
    payload = {
        "next": sanitize_return_to(return_to),
        "iat": int(time.time()),
        "nonce": secrets.token_urlsafe(16),
    }
    payload_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_json).rstrip(b"=")
    signature = hmac.new(
        _get_oauth_state_secret().encode("utf-8"),
        payload_b64,
        hashlib.sha256,
    ).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=")
    return f"{payload_b64.decode('utf-8')}.{signature_b64.decode('utf-8')}"


def parse_signed_oauth_state(state: str) -> str:
    try:
        payload_part, signature_part = state.split(".", 1)
        payload_bytes = payload_part.encode("utf-8")
        expected_signature = hmac.new(
            _get_oauth_state_secret().encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).digest()
        provided_signature = base64.urlsafe_b64decode(signature_part + "=" * (-len(signature_part) % 4))

        if not hmac.compare_digest(expected_signature, provided_signature):
            raise ValueError("Invalid OAuth state signature")

        payload_json = base64.urlsafe_b64decode(payload_part + "=" * (-len(payload_part) % 4))
        payload = json.loads(payload_json.decode("utf-8"))

        issued_at = int(payload.get("iat", 0))
        if not issued_at or (time.time() - issued_at) > OAUTH_STATE_MAX_AGE_SECONDS:
            raise ValueError("OAuth state expired")

        return sanitize_return_to(payload.get("next"))
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid state parameter") from exc


@router.get("/login")
async def login(next: Optional[str] = None):
    """
    Initiate Google OAuth flow
    Redirects user to Google consent screen
    """
    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI]
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI
        )
        
        authorization_kwargs = {
            "access_type": "offline",
            "include_granted_scopes": "true",
            "state": create_signed_oauth_state(sanitize_return_to(next)),
        }
        if GOOGLE_OAUTH_PROMPT:
            authorization_kwargs["prompt"] = GOOGLE_OAUTH_PROMPT

        authorization_url, _ = flow.authorization_url(**authorization_kwargs)

        response = RedirectResponse(url=authorization_url)
        return response
        
    except Exception as e:
        print(f"OAuth login error: {e}")
        raise HTTPException(status_code=500, detail="Failed to initiate login")


@router.get("/callback")
async def callback(request: Request, code: str, state: str):
    """
    Handle OAuth callback from Google
    Exchange authorization code for user info and create session
    """
    try:
        return_to = parse_signed_oauth_state(state)
        
        # Exchange code for tokens
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_REDIRECT_URI]
                }
            },
            scopes=SCOPES,
            redirect_uri=GOOGLE_REDIRECT_URI,
            state=state
        )
        
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
            "picture": idinfo.get("picture")
        }
        
        # Create or update user in database when available.
        # Login should still complete if Supabase is temporarily unreachable.
        if not auth_db.create_or_update_user(user_data):
            print("OAuth callback warning: failed to persist user profile to database")
        
        # Generate JWT token
        token = create_access_token(
            user_id=user_data["id"],
            email=user_data["email"],
            name=user_data.get("name")
        )
        
        # Set cookie and redirect to the original page.
        # Token is passed as a query param for the frontend to capture once.
        redirect_path = append_token(return_to, token)
        response = RedirectResponse(
            url=build_frontend_redirect(redirect_path),
            status_code=302
        )
        cookie_config = create_auth_cookie(token)
        response.set_cookie(**cookie_config)

        return response
    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


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
