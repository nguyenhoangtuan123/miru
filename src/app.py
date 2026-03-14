# file: pwa_server.py
"""
FastAPI Server for Miru PWA
Provides REST API and WebSocket endpoints for the Progressive Web App
"""

import os
import socket
from urllib.parse import urlparse
from datetime import datetime, timezone
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Import Routers
from auth_routes import router as auth_router
from profile_routes import router as profile_router
from therapist_routes import router as therapist_router
from memory_routes import router as memory_router
from proactive_routes import router as proactive_router
from push_routes import router as push_router

from routers.journal import router as journal_router
from routers.goals import router as goals_router
from routers.chat import router as chat_router
from routers.insights import router as insights_router
from proactive_push_service import proactive_push_scheduler
from assignment_reminder_service import assignment_reminder_scheduler
from consent_routes import router as consent_router

# Load env
load_dotenv()

def _is_schema_error(exc: Exception, fragment: str) -> bool:
    return fragment.lower() in str(exc).lower()


def _build_user_payload(user_claims: dict, db_user: dict | None = None, role: str | None = None) -> dict:
    return {
        "id": user_claims.get("sub") or user_claims.get("user_id"),
        "name": user_claims.get("name") or (db_user or {}).get("name"),
        "email": user_claims.get("email") or (db_user or {}).get("email"),
        "picture": user_claims.get("picture") or (db_user or {}).get("picture"),
        "role": role,
    }


def _check_supabase_reachability(timeout_seconds: float = 2.0) -> tuple[bool, str | None]:
    supabase_url = os.getenv("SUPABASE_URL", "").strip().strip('"').strip("'")
    hostname = urlparse(supabase_url).hostname if supabase_url else None

    if not hostname:
        return False, "SUPABASE_URL is not configured"

    try:
        with socket.create_connection((hostname, 443), timeout=timeout_seconds):
            return True, None
    except OSError as exc:
        return False, str(exc)


def _get_user_role(db, user_id: str) -> str | None:
    role = None

    try:
        profile_res = (
            db.supabase.table("user_profiles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
        print(f"[DEBUG] user_profiles query result: {profile_res.data}")
        if profile_res.data and len(profile_res.data) > 0:
            role = profile_res.data[0].get("role")
            print(f"[DEBUG] Found role in user_profiles: {role}")
    except Exception as exc:
        if not _is_schema_error(exc, "user_profiles.role"):
            print(f"[DEBUG] Error reading user_profiles: {exc}")

    if role:
        return role

    try:
        therapist_res = (
            db.supabase.table("therapists")
            .select("id")
            .eq("user_id", user_id)
            .execute()
        )
        print(f"[DEBUG] therapists query by user_id result: {therapist_res.data}")
        if therapist_res.data and len(therapist_res.data) > 0:
            print("[DEBUG] Found user in therapists table by user_id, setting role to therapist")
            return "therapist"
    except Exception as exc:
        print(f"[DEBUG] Error reading therapists by user_id: {exc}")

    try:
        therapist_res = (
            db.supabase.table("therapists")
            .select("id")
            .eq("id", user_id)
            .execute()
        )
        print(f"[DEBUG] therapists query by id result: {therapist_res.data}")
        if therapist_res.data and len(therapist_res.data) > 0:
            print("[DEBUG] Found user in therapists table by id, setting role to therapist")
            return "therapist"
    except Exception as exc:
        print(f"[DEBUG] Error reading therapists by id: {exc}")

    return "client"


APP_CONSENT_VERSION = os.getenv("APP_CONSENT_VERSION", "v1")
APP_CONSENT_TYPES = {
    "terms": "app_terms",
    "privacy": "app_privacy",
    "ai_support": "app_ai_support_disclaimer",
}


def _empty_app_consent() -> dict:
    return {
        "accepted": False,
        "version": APP_CONSENT_VERSION,
        "accepted_at": None,
        "items": {
            "terms": False,
            "privacy": False,
            "ai_support": False,
        },
    }


def _read_app_consent(db, user_id: str) -> dict:
    consent = _empty_app_consent()
    try:
        response = (
            db.supabase.table("privacy_consent_log")
            .select("consent_type, consent_given, consent_date")
            .eq("user_id", user_id)
            .order("consent_date", desc=True)
            .limit(50)
            .execute()
        )
        latest: dict[str, tuple[bool, str | None]] = {}
        for row in response.data or []:
            consent_type = row.get("consent_type")
            if consent_type not in APP_CONSENT_TYPES.values() or consent_type in latest:
                continue
            latest[consent_type] = (
                bool(row.get("consent_given")),
                row.get("consent_date"),
            )

        accepted_dates: list[str] = []
        for key, consent_type in APP_CONSENT_TYPES.items():
            given, consent_date = latest.get(consent_type, (False, None))
            consent["items"][key] = given
            if given and consent_date:
                accepted_dates.append(str(consent_date))

        consent["accepted"] = all(consent["items"].values())
        consent["accepted_at"] = max(accepted_dates) if accepted_dates else None
    except Exception as exc:
        print(f"[Consent] Failed to read app consent: {exc}")
    return consent


def _write_app_consent(db, user_id: str, request: Request, accepted: dict[str, bool]) -> dict:
    rows = []
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent", "")[:500]
    consent_date = datetime.now(timezone.utc).isoformat()

    for key, consent_type in APP_CONSENT_TYPES.items():
        rows.append(
            {
                "user_id": user_id,
                "therapist_id": None,
                "consent_type": consent_type,
                "consent_given": bool(accepted.get(key)),
                "consent_date": consent_date,
                "ip_address": ip_address,
                "user_agent": user_agent,
            }
        )

    db.supabase.table("privacy_consent_log").insert(rows).execute()
    return _read_app_consent(db, user_id)

# ==================== App Initialization ====================

app = FastAPI(
    title="Miru PWA Server",
    description="Backend API for Miru Mental Health PWA",
    version="1.0.0"
)

# CORS - Allow frontend to connect
# Production: Chỉ định exact origins từ env, fallback localhost cho dev
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8008,http://127.0.0.1:8008",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Register authentication routes
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(therapist_router)
app.include_router(memory_router)
app.include_router(proactive_router)
app.include_router(push_router)
app.include_router(consent_router)

# Register new modular routes
app.include_router(journal_router)
app.include_router(goals_router)
app.include_router(chat_router)
app.include_router(insights_router)

# Serve static files (images)
app.mount("/picture_avatar", StaticFiles(directory="picture_avatar"), name="picture_avatar")


@app.on_event("startup")
async def startup_background_services():
    await proactive_push_scheduler.start()
    await assignment_reminder_scheduler.start()


@app.on_event("shutdown")
async def shutdown_background_services():
    await proactive_push_scheduler.stop()
    await assignment_reminder_scheduler.stop()

# ==================== API Endpoints ====================

@app.get("/api/health")
async def health():
    """Detailed health check"""
    from utils import LOCAL_TZ
    from datetime import datetime

    db_connected, db_error = _check_supabase_reachability()

    return {
        "status": "healthy" if db_connected else "degraded",
        "timestamp": datetime.now(LOCAL_TZ).isoformat(),
        "database": "connected" if db_connected else "unreachable",
        "database_error": db_error,
    }

@app.get("/api/user-id")
async def get_user_id(request: Request):
    """Get the authenticated user's ID."""
    from auth_middleware import get_current_user as get_user

    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})

    user_id = user.get("sub") or user.get("user_id")
    return {"user_id": user_id}


# === User Role Endpoints ===

class RoleUpdate(BaseModel):
    role: str  # 'client' or 'therapist'


class AppConsentUpdate(BaseModel):
    terms: bool
    privacy: bool
    ai_support: bool


@app.get("/api/user/me")
async def get_current_user(request: Request):
    """Get current authenticated user info including role"""
    from auth_middleware import get_current_user as get_user
    from database import DatabaseManager
    
    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    
    user_id = user.get("sub") or user.get("user_id")
    print(f"[DEBUG] get_current_user: user_id = {user_id}")

    db_user = None
    role = None
    warning = None

    try:
        db = DatabaseManager()
        db_user = db.get_or_create_user(
            user_id,
            name=user.get("name"),
            email=user.get("email"),
        )
        role = _get_user_role(db, user_id)
    except Exception as exc:
        warning = "Database unavailable; returning user data from JWT only."
        print(f"[DEBUG] Falling back to JWT claims for /api/user/me: {exc}")

    print(f"[DEBUG] Final role: {role}")

    response = {"user": _build_user_payload(user, db_user=db_user, role=role)}
    if warning:
        response["warning"] = warning
    return response


@app.get("/api/user/consent")
async def get_user_consent(request: Request):
    from auth_middleware import get_current_user as get_user
    from database import DatabaseManager

    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})

    user_id = user.get("sub") or user.get("user_id")
    db = DatabaseManager()
    return {"success": True, "consent": _read_app_consent(db, user_id)}


@app.post("/api/user/consent")
async def accept_user_consent(data: AppConsentUpdate, request: Request):
    from auth_middleware import get_current_user as get_user
    from database import DatabaseManager

    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})

    if not (data.terms and data.privacy and data.ai_support):
        return JSONResponse(
            status_code=400,
            content={"error": "All consent items must be accepted to continue."},
        )

    user_id = user.get("sub") or user.get("user_id")
    db = DatabaseManager()
    consent = _write_app_consent(
        db,
        user_id,
        request,
        {
            "terms": data.terms,
            "privacy": data.privacy,
            "ai_support": data.ai_support,
        },
    )
    return {"success": True, "consent": consent}


@app.post("/api/user/role")
async def set_user_role(data: RoleUpdate, request: Request):
    """Set user role (client or therapist)"""
    from auth_middleware import get_current_user as get_user
    from database import DatabaseManager
    
    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    
    if data.role not in ['client', 'therapist']:
        return JSONResponse(status_code=400, content={"error": "Invalid role"})
    
    user_id = user.get("sub") or user.get("user_id")

    try:
        db = DatabaseManager()
        db_user = db.get_or_create_user(
            user_id,
            name=user.get("name"),
            email=user.get("email"),
        )
    except Exception as exc:
        print(f"[Role] Database unavailable while setting role: {exc}")
        return {
            "success": False,
            "role": data.role,
            "warning": "Database unavailable; role was not persisted.",
        }

    persisted = False
    warnings = []

    # Upsert role in user_profiles
    try:
        db.supabase.table('user_profiles').upsert({
            'user_id': user_id,
            'role': data.role
        }, on_conflict='user_id').execute()
        persisted = True
    except Exception as e:
        # If user_profiles table doesn't have role column, add it to users table
        if not _is_schema_error(e, "user_profiles"):
            print(f"[Role] Error saving to user_profiles: {e}")
        try:
            db.supabase.table('users').update({
                'role': data.role
            }).eq('id', user_id).execute()
            persisted = True
        except Exception as e2:
            if not _is_schema_error(e2, "users"):
                print(f"[Role] Error saving to users: {e2}")
            warnings.append("Role was not persisted in role columns.")
    
    # If therapist, also create therapist record
    if persisted and data.role == 'therapist':
        try:
            from therapist_service import get_therapist_service
            service = get_therapist_service()
            
            therapist = service.ensure_therapist_profile(
                user_id=user_id,
                email=user.get("email") or (db_user or {}).get("email", ""),
                name=user.get("name") or (db_user or {}).get("name", ""),
            )
            if therapist:
                persisted = True
                print(f"[Role] Therapist profile ready for {user_id}: {therapist.get('id')}")
            else:
                warnings.append("Role saved, but therapist profile is still unavailable.")
        except Exception as e:
            print(f"[Role] Error creating therapist: {e}")
            warnings.append("Role saved, but therapist profile creation failed.")
    elif data.role == 'client':
        persisted = True

    response = {"success": persisted, "role": data.role}
    if warnings:
        response["warning"] = " ".join(warnings)
    return response

if __name__ == "__main__":
    import uvicorn
    print("Starting Miru backend API server...")
    print("API endpoints at: http://localhost:8008/api")
    print("WebSocket chat at: ws://localhost:8008/ws/chat/{user_id}")
    uvicorn.run(app, host="0.0.0.0", port=8008, reload=False)
