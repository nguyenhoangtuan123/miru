# file: pwa_server.py
"""
FastAPI Server for Miru PWA
Provides REST API and WebSocket endpoints for the Progressive Web App
"""

import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

# Import Routers
from auth_routes import router as auth_router
from therapist_routes import router as therapist_router
from user_routes import router as user_router
from memory_routes import router as memory_router
from proactive_routes import router as proactive_router

from routers.journal import router as journal_router
from routers.goals import router as goals_router
from routers.chat import router as chat_router
from routers.insights import router as insights_router
from routers.pages import router as pages_router

# Load env
load_dotenv()

# MCP Server connection
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "http://127.0.0.1:8020/sse")

# ==================== App Initialization ====================

app = FastAPI(
    title="Miru PWA Server",
    description="Backend API for Miru Mental Health PWA",
    version="1.0.0"
)

# CORS - Allow frontend to connect
# Production: Chỉ định exact origins từ env, fallback localhost cho dev
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:8008,http://127.0.0.1:8008").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
)

# Register authentication routes
app.include_router(auth_router)
app.include_router(therapist_router)
app.include_router(user_router)
app.include_router(memory_router)
app.include_router(proactive_router)

# Register new modular routes
app.include_router(journal_router)
app.include_router(goals_router)
app.include_router(chat_router)
app.include_router(insights_router)
app.include_router(pages_router)

# Serve static files (images)
app.mount("/picture_avatar", StaticFiles(directory="picture_avatar"), name="picture_avatar")

# Mount PWA static assets (CSS, JS, images)
app.mount("/pwa/css", StaticFiles(directory="pwa/css"), name="pwa_css")
app.mount("/pwa/js", StaticFiles(directory="pwa/js"), name="pwa_js")
app.mount("/pwa/images", StaticFiles(directory="pwa/images"), name="pwa_images")
app.mount("/images", StaticFiles(directory="pwa/images"), name="images_compat")
app.mount("/static", StaticFiles(directory="pwa"), name="static")

# Mount Therapist UI static files
if os.path.exists("therapist_UI"):
    app.mount("/therapist/static", StaticFiles(directory="therapist_UI"), name="therapist_static")

# ==================== Therapist UI Routes ====================

@app.get("/therapist")
@app.get("/therapist/")
async def therapist_dashboard():
    """Serve therapist dashboard"""
    if os.path.exists("therapist_UI/dashboard.html"):
        return FileResponse("therapist_UI/dashboard.html")
    return JSONResponse(status_code=404, content={"error": "Therapist UI not found"})

@app.get("/therapist/{page}.html")
async def therapist_page(page: str):
    """Serve therapist pages"""
    file_path = f"therapist_UI/{page}.html"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    return JSONResponse(status_code=404, content={"error": f"Page {page} not found"})

@app.get("/therapist/styles.css")
async def therapist_styles():
    """Serve therapist styles"""
    return FileResponse("therapist_UI/styles.css", media_type="text/css")

@app.get("/therapist/api.js")
async def therapist_api_js():
    """Serve therapist API client"""
    return FileResponse("therapist_UI/api.js", media_type="application/javascript")

# ==================== Android TWA AssetLinks ====================

@app.get("/.well-known/assetlinks.json")
async def assetlinks():
    """Serve Digital Asset Links for Android TWA verification"""
    return JSONResponse(
        content=[{
            "relation": ["delegate_permission/common.handle_all_urls"],
            "target": {
                "namespace": "android_app",
                "package_name": "com.miru.app",
                "sha256_cert_fingerprints": [
                    os.getenv("ANDROID_SHA256_FINGERPRINT", "REPLACE_WITH_YOUR_SHA256_FINGERPRINT")
                ]
            }
        }],
        media_type="application/json"
    )

# Mount React build static assets
if os.path.exists("pwa-react"):
    app.mount("/assets", StaticFiles(directory="pwa-react/assets"), name="react_assets")

# ==================== API Endpoints ====================

@app.get("/api/health")
async def health():
    """Detailed health check"""
    from utils import LOCAL_TZ
    from datetime import datetime
    return {
        "status": "healthy",
        "timestamp": datetime.now(LOCAL_TZ).isoformat(),
        "database": "connected",
        "mcp_server": MCP_SERVER_URL
    }

@app.get("/api/user-id")
async def get_user_id():
    """Get user ID from environment"""
    user_id = os.getenv("USER_ID", "user_alex")
    return {"user_id": user_id}


# === User Role Endpoints ===

class RoleUpdate(BaseModel):
    role: str  # 'client' or 'therapist'


@app.get("/api/user/me")
async def get_current_user(request: Request):
    """Get current authenticated user info including role"""
    from auth_middleware import get_current_user as get_user
    from database import DatabaseManager
    
    user = await get_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    
    user_id = user.get("sub") or user.get("user_id")
    
    # Get additional info from database
    db = DatabaseManager()
    db_user = db.get_or_create_user(user_id)
    
    # Get role from user_profiles or users table
    role = None
    try:
        profile_res = db.supabase.table('user_profiles') \
            .select('role') \
            .eq('user_id', user_id) \
            .execute()
        if profile_res.data and profile_res.data[0].get('role'):
            role = profile_res.data[0]['role']
    except:
        pass
    
    return {
        "user": {
            "id": user_id,
            "name": user.get("name") or db_user.get("name"),
            "email": user.get("email") or db_user.get("email"),
            "picture": user.get("picture"),
            "role": role
        }
    }


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
    
    db = DatabaseManager()
    
    # Ensure user exists in users table
    db_user = db.get_or_create_user(user_id)
    
    # Upsert role in user_profiles
    try:
        db.supabase.table('user_profiles').upsert({
            'user_id': user_id,
            'role': data.role
        }, on_conflict='user_id').execute()
    except Exception as e:
        # If user_profiles table doesn't have role column, add it to users table
        print(f"[Role] Error saving to user_profiles: {e}")
        try:
            db.supabase.table('users').update({
                'role': data.role
            }).eq('google_id', user_id).execute()
        except Exception as e2:
            print(f"[Role] Error saving to users: {e2}")
    
    # If therapist, also create therapist record
    if data.role == 'therapist':
        try:
            from therapist_service import get_therapist_service
            service = get_therapist_service()
            
            # Check if therapist exists
            existing = service.get_therapist(user_id)
            if not existing:
                # Create therapist record
                service.create_therapist(
                    email=user.get("email") or db_user.get("email", ""),
                    name=user.get("name") or db_user.get("name", ""),
                    license_number=None
                )
        except Exception as e:
            print(f"[Role] Error creating therapist: {e}")
    
    return {"success": True, "role": data.role}


if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Miru PWA Server...")
    print("📱 PWA will be available at: http://localhost:8008/app")
    print("🔌 API endpoints at: http://localhost:8008/api")
    print("💬 WebSocket chat at: ws://localhost:8008/ws/chat/{user_id}")
    uvicorn.run(
        "pwa_server:app", 
        host="0.0.0.0", 
        port=8008, 
        reload=False,
    )
