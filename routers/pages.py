
import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

# No prefix, handle individually
router = APIRouter(tags=["Pages"])

@router.get("/")
async def serve_landing():
    """Serve Landing Page"""
    return FileResponse("pwa/landing.html")

@router.get("/auth")
async def serve_auth_alias():
    return FileResponse("pwa/auth.html")

@router.get("/auth.html")
async def serve_auth():
    """Serve Auth Page"""
    return FileResponse("pwa/auth.html")

@router.get("/app")
async def serve_app_home():
    """Serve App Dashboard (Journal)"""
    return FileResponse("pwa/app.html")

@router.get("/app/auth")
async def serve_app_auth():
    """Serve Auth Page within app context"""
    return FileResponse("pwa/auth.html")

@router.get("/app/chat")
async def serve_chat_page():
    """Serve Chat Interface"""
    return FileResponse("pwa/chat.html")

@router.get("/app/insights")
async def serve_insights_page():
    """Serve insights page"""
    return FileResponse("pwa/insights.html")

@router.get("/app/history")
async def serve_history_page():
    """Serve conversation history page"""
    return FileResponse("pwa/history.html")

@router.get("/app/settings")
async def serve_settings_page():
    """Serve settings page"""
    return FileResponse("pwa/settings.html")

@router.get("/app/memories")
async def serve_memories_page():
    """Serve memories management page"""
    return FileResponse("pwa/memories.html")

@router.get("/app/orb")
async def app_orb():
    return FileResponse("pwa/orb.html")

@router.get("/app/emotion-dashboard")
async def app_emotion_dashboard():
    """Serve Emotion Analytics Dashboard"""
    return FileResponse("pwa/emotion-dashboard.html")

@router.get("/login")
async def serve_login():
    """Serve login page"""
    return FileResponse("pwa/login.html")

@router.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest"""
    return FileResponse("pwa/manifest.json", media_type="application/json")

@router.get("/config.js")
async def serve_config_js():
    """Serve config.js"""
    return FileResponse("pwa/config.js", media_type="application/javascript")

@router.get("/service-worker.js")
async def serve_sw():
    """Serve service worker"""
    return FileResponse("pwa/service-worker.js", media_type="application/javascript")

@router.get("/favicon.ico")
async def favicon():
    """Serve favicon as SVG"""
    return FileResponse("pwa/images/favicon.svg", media_type="image/svg+xml")

@router.get("/therapist")
async def therapist_dashboard():
    """Serve therapist dashboard page"""
    return FileResponse("pwa/therapist-dashboard.html")

@router.get("/home")
async def home_page():
    """Serve minimal chat UI"""
    return FileResponse("pwa/chat.html")

@router.get("/orb")
async def orb_page():
    """Serve Living Orb (AI Agent) page"""
    return FileResponse("pwa/orb.html")

# Client-side routing fallback
@router.get("/app/{full_path:path}")
async def serve_pwa_other(full_path: str):
    """Serve other PWA pages or fallback to app.html"""
    file_path = f"pwa/{full_path}.html" if not full_path.endswith('.html') else f"pwa/{full_path}"
    try:
        if os.path.exists(file_path):
            return FileResponse(file_path)
        else:
            return FileResponse("pwa/app.html")
    except:
        return FileResponse("pwa/app.html")

# Catch-all for root .html files
@router.get("/{filename}.html")
async def serve_html_file(filename: str):
    """Serve any .html file from pwa directory"""
    file_path = f"pwa/{filename}.html"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="Page not found")
