# file: pwa_server.py
"""
FastAPI Server for Miru PWA
Provides REST API and WebSocket endpoints for the Progressive Web App
"""

import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from dotenv import load_dotenv

# Import Routers
from auth_routes import router as auth_router
from therapist_routes import router as therapist_router
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
