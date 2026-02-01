"""
Google OAuth routes for authentication
Handles login, callback, logout, and user info endpoints
"""
import os
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

# OAuth scopes
SCOPES = [
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
]

router = APIRouter(prefix="/auth", tags=["authentication"])
auth_db = AuthDatabase()


@router.get("/login")
async def login():
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
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true'
        )
        
        # Store state in session for CSRF protection
        response = RedirectResponse(url=authorization_url)
        response.set_cookie("oauth_state", state, httponly=True, max_age=600)
        
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
        print("[AUTH] Callback started")
        
        # Verify state for CSRF protection
        stored_state = request.cookies.get("oauth_state")
        if not stored_state or stored_state != state:
            print(f"[AUTH] State mismatch: stored={stored_state}, received={state}")
            raise HTTPException(status_code=400, detail="Invalid state parameter")
        
        print("[AUTH] State verified OK")
        
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
        print("[AUTH] Token fetched OK")
        
        # Verify and decode ID token
        idinfo = id_token.verify_oauth2_token(
            credentials.id_token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
        print(f"[AUTH] ID token verified, user: {idinfo.get('email')}")
        
        # Extract user info
        user_data = {
            "id": idinfo["sub"],
            "email": idinfo["email"],
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture")
        }
        
        # Create or update user in database
        auth_db.create_or_update_user(user_data)
        print("[AUTH] User saved to DB")
        
        # Generate JWT token
        token = create_access_token(
            user_id=user_data["id"],
            email=user_data["email"],
            name=user_data.get("name")
        )
        print(f"[AUTH] JWT created, length: {len(token)}")
        
        # Set cookie and redirect to app
        redirect_url = "/app/chat"
        
        response = RedirectResponse(url=redirect_url, status_code=302)
        cookie_config = create_auth_cookie(token)
        print(f"[AUTH] Cookie config: {cookie_config}")
        response.set_cookie(**cookie_config)
        print(f"[AUTH] Cookie set, redirecting to {redirect_url}")
        
        # Clear OAuth state cookie
        response.delete_cookie("oauth_state")
        
        return response
        
    except Exception as e:
        print(f"OAuth callback error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@router.post("/logout")
async def logout():
    """
    Logout user by clearing auth cookie
    """
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
    
    # Fetch full user data from database
    user_data = auth_db.get_user_by_id(user["sub"])
    
    if not user_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "id": user_data["id"],
        "email": user_data["email"],
        "name": user_data["name"],
        "picture": user_data["picture"]
    }
